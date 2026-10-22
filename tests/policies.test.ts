import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const owner = "11111111-1111-4111-8111-111111111111";
const stranger = "22222222-2222-4222-8222-222222222222";
const id = "33333333-3333-4333-8333-333333333333";
const path = `${owner}/${id}.mp3`;
test("PostgreSQL policies enforce owner-only access on data and storage", async (t) => {
  const db = new PGlite();
  await db.exec(
    `
 create role anon; create role authenticated;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub' $$;
 `.replace(
      "select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'",
      "select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid",
    ),
  );
  await db.exec(`
 create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
 create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema public, auth, storage to anon, authenticated;
 grant select,insert,update,delete on storage.objects to anon, authenticated;
 insert into auth.users values ('${owner}'),('${stranger}');
 `);
  await db.exec(
    readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  );
  await db.exec(`insert into public.app_owner(user_id) values ('${owner}');`);
  async function as(
    role: string,
    uid: string | null,
    aal: string,
    fn: () => Promise<void>,
  ) {
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid, aal }),
    ]);
    await db.exec(`set role ${role}`);
    try {
      await fn();
    } finally {
      await db.exec("reset role");
    }
  }
  const insertTrack = () =>
    db.query(
      "insert into public.tracks(owner_id,title,kind,object_path,size) values ($1,'Private song','audio',$2,1024)",
      [owner, path],
    );
  await t.test(
    "anonymous cannot read or insert metadata, claim ownership, upload, or read files",
    async () => {
      await as("anon", null, "aal1", async () => {
        await assert.rejects(() => db.query("select * from public.tracks"));
        await assert.rejects(insertTrack);
        await assert.rejects(() =>
          db.query("insert into public.app_owner(user_id) values ($1)", [
            stranger,
          ]),
        );
        await assert.rejects(() =>
          db.query(
            "insert into storage.objects(bucket_id,name) values ('media',$1)",
            [path],
          ),
        );
        assert.equal(
          (await db.query("select * from storage.objects")).rows.length,
          0,
        );
      });
    },
  );
  await t.test(
    "fresh schema and repeatable migration allow password-only owner access",
    async () => {
      const allowed = async () => {
        await as("authenticated", owner, "aal1", async () => {
          assert.equal(
            (
              await db.query<{ allowed: boolean }>(
                "select public.is_library_owner() as allowed",
              )
            ).rows[0].allowed,
            true,
          );
        });
      };
      await allowed();
      // Reproduce the old installed function, then exercise the real upgrade SQL.
      await db.exec(`create or replace function public.is_library_owner() returns boolean
      language sql stable security definer set search_path = '' as $$
      select (select auth.jwt()->>'aal') = 'aal2'
      and exists (select 1 from public.app_owner where user_id = (select auth.uid())); $$;`);
      await as("authenticated", owner, "aal1", async () => {
        await assert.rejects(insertTrack);
      });
      const migration = readFileSync(
        new URL(
          "../supabase/migrations/20261022_password_only_owner.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await db.exec(migration);
      await allowed();
      await db.exec(migration);
      await allowed();
    },
  );
  await t.test(
    "password-only owner can create and read private files, tracks, and playlist",
    async () => {
      await as("authenticated", owner, "aal1", async () => {
        await insertTrack();
        await db.query(
          "insert into storage.objects(bucket_id,name) values ('media',$1)",
          [path],
        );
        assert.equal(
          (await db.query("select * from public.tracks")).rows.length,
          1,
        );
        assert.equal(
          (await db.query("select * from storage.objects")).rows.length,
          1,
        );
        await db.query(
          "insert into public.playlists(owner_id,name) values ($1,'My favorites')",
          [owner],
        );
        assert.equal(
          (await db.query("select * from public.playlists")).rows.length,
          1,
        );
        await db.query("update public.tracks set favorite=true");
        assert.equal(
          (
            await db.query<{ favorite: boolean }>(
              "select favorite from public.tracks",
            )
          ).rows[0].favorite,
          true,
        );
      });
    },
  );
  await t.test(
    "another account with MFA cannot read, mutate, upload, or take ownership",
    async () => {
      await as("authenticated", stranger, "aal2", async () => {
        for (const table of [
          "public.app_owner",
          "public.tracks",
          "public.playlists",
          "storage.objects",
        ])
          assert.equal(
            (await db.query(`select * from ${table}`)).rows.length,
            0,
          );
        await assert.rejects(() =>
          db.query("update public.app_owner set user_id=$1", [stranger]),
        );
        await assert.rejects(insertTrack);
        await assert.rejects(() =>
          db.query(
            "insert into storage.objects(bucket_id,name) values ('media',$1)",
            [`${stranger}/${id}.mp3`],
          ),
        );
        assert.equal(
          (await db.query("delete from public.tracks returning *")).rows.length,
          0,
        );
        assert.equal(
          (await db.query("delete from storage.objects returning *")).rows
            .length,
          0,
        );
      });
    },
  );
  await t.test(
    "password-only owner reads existing files and an unregistered password-only account cannot",
    async () => {
      for (const [uid, count] of [
        [owner, 1],
        [stranger, 0],
      ] as const) {
        await as("authenticated", uid, "aal1", async () => {
          for (const table of [
            "public.tracks",
            "public.playlists",
            "storage.objects",
          ])
            assert.equal(
              (await db.query(`select * from ${table}`)).rows.length,
              count,
            );
        });
      }
    },
  );
  await t.test(
    "owner cannot bypass file paths, metadata size limits, or immutable storage",
    async () => {
      await as("authenticated", owner, "aal1", async () => {
        for (const bad of [
          `${stranger}/${id}.mp3`,
          `${owner}/../../payload.mp3`,
          `${owner}/${id}.html`,
        ])
          await assert.rejects(() =>
            db.query(
              "insert into storage.objects(bucket_id,name) values ('media',$1)",
              [bad],
            ),
          );
        await assert.rejects(() =>
          db.query("update public.tracks set size=52428801"),
        );
        await assert.rejects(() =>
          db.query("update public.tracks set owner_id=$1", [stranger]),
        );
        assert.equal(
          (
            await db.query(
              "update storage.objects set name='overwrite' returning *",
            )
          ).rows.length,
          0,
        );
        await assert.rejects(() => db.query("delete from public.app_owner"));
      });
    },
  );
  await t.test(
    "password-only owner can delete their files and metadata",
    async () => {
      await as("authenticated", owner, "aal1", async () => {
        assert.equal(
          (await db.query("delete from storage.objects returning *")).rows
            .length,
          1,
        );
        assert.equal(
          (await db.query("delete from public.tracks returning *")).rows.length,
          1,
        );
        assert.equal(
          (await db.query("delete from public.playlists returning *")).rows
            .length,
          1,
        );
      });
    },
  );
  await db.close();
});
