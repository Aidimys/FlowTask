


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_accessible_boards"("user_id" "uuid") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
  -- Доски, где юзер является создателем/владельцем
  SELECT id FROM public.boards WHERE owner_id = $1
  UNION
  -- Доски, где юзер является приглашенным участником
  SELECT board_id FROM public.board_members WHERE user_id = $1;
$_$;


ALTER FUNCTION "public"."get_accessible_boards"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_id_by_email"("email_text" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  return (select id from auth.users where email = email_text limit 1);
end;
$$;


ALTER FUNCTION "public"."get_user_id_by_email"("email_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 
    null
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_tasks"("p_task_id" "uuid", "p_target_column_id" "uuid", "p_new_position" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_old_column_id uuid;
    v_old_position integer;
BEGIN
    -- 1. Получаем текущую колонку и позицию перемещаемой задачи
    SELECT column_id, position INTO v_old_column_id, v_old_position
    FROM public.tasks
    WHERE id = p_task_id;

    -- Если задача не найдена, прерываем выполнение
    IF v_old_position IS NULL THEN
        RETURN;
    END IF;

    -- 2. Логика перемещения ВНУТРИ одной и той же колонки
    IF v_old_column_id = p_target_column_id THEN
        IF p_new_position < v_old_position THEN
            -- Перемещение СНИЗУ ВВЕРХ: сдвигаем промежуточные задачи вниз (+1)
            UPDATE public.tasks
            SET position = position + 1
            WHERE column_id = v_old_column_id
              AND position >= p_new_position
              AND position < v_old_position
              AND id <> p_task_id;
              
        ELSIF p_new_position > v_old_position THEN
            -- Перемещение СВЕРХУ ВНИЗ: сдвигаем промежуточные задачи вверх (-1)
            UPDATE public.tasks
            SET position = position - 1
            WHERE column_id = v_old_column_id
              AND position <= p_new_position
              AND position > v_old_position
              AND id <> p_task_id;
        END IF;

    -- 3. Логика перемещения МЕЖДУ РАЗНЫМИ колонками
    ELSE
        -- Схлопываем позиции в старой колонке (убираем "дыру" после ушедшей задачи)
        UPDATE public.tasks
        SET position = position - 1
        WHERE column_id = v_old_column_id
          AND position > v_old_position;

        -- Раздвигаем позиции в новой колонке (освобождаем место под новую задачу)
        UPDATE public.tasks
        SET position = position + 1
        WHERE column_id = p_target_column_id
          AND position >= p_new_position;
    END IF;

    -- 4. Устанавливаем финальную точную позицию для самой задачи
    UPDATE public.tasks
    SET column_id = p_target_column_id,
        position = p_new_position
    WHERE id = p_task_id;
END;
$$;


ALTER FUNCTION "public"."reorder_tasks"("p_task_id" "uuid", "p_target_column_id" "uuid", "p_new_position" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "action_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."activity_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    CONSTRAINT "board_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."board_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text",
    "avatar_url" "text",
    "full_name" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."board_members_with_emails" AS
 SELECT "bm"."id" AS "member_id",
    "bm"."board_id",
    "bm"."user_id",
    "bm"."role",
    "u"."email" AS "user_email",
    COALESCE("p"."name", "p"."full_name", ''::"text") AS "full_name",
    COALESCE("p"."avatar_url", ''::"text") AS "avatar_url"
   FROM (("public"."board_members" "bm"
     JOIN "auth"."users" "u" ON (("bm"."user_id" = "u"."id")))
     LEFT JOIN "public"."profiles" "p" ON (("bm"."user_id" = "p"."id")));


ALTER VIEW "public"."board_members_with_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."boards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "owner_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."boards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."columns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY "public"."columns" REPLICA IDENTITY FULL;


ALTER TABLE "public"."columns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "column_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "priority" "text" DEFAULT 'medium'::"text",
    "due_date" "date",
    "assignee_id" "uuid",
    "position" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "board_id" "uuid",
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"])))
);

ALTER TABLE ONLY "public"."tasks" REPLICA IDENTITY FULL;


ALTER TABLE "public"."tasks" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."board_members"
    ADD CONSTRAINT "board_members_board_id_user_id_key" UNIQUE ("board_id", "user_id");



ALTER TABLE ONLY "public"."board_members"
    ADD CONSTRAINT "board_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."columns"
    ADD CONSTRAINT "columns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_members"
    ADD CONSTRAINT "board_members_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_members"
    ADD CONSTRAINT "board_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."columns"
    ADD CONSTRAINT "columns_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "public"."columns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



CREATE POLICY "Allow authenticated users to insert boards" ON "public"."boards" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Allow insert for authenticated users" ON "public"."activity_logs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow select for authenticated users" ON "public"."activity_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow select for authenticated users" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow users to select their own boards" ON "public"."boards" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Users can delete columns" ON "public"."columns" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Users can delete tasks" ON "public"."tasks" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Users can insert columns" ON "public"."columns" FOR INSERT TO "authenticated" WITH CHECK (("board_id" IN ( SELECT "boards"."id"
   FROM "public"."boards")));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert tasks" ON "public"."tasks" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can update columns" ON "public"."columns" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update tasks" ON "public"."tasks" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Users can view columns" ON "public"."columns" FOR SELECT TO "authenticated" USING (("board_id" IN ( SELECT "boards"."id"
   FROM "public"."boards")));



CREATE POLICY "Users can view tasks" ON "public"."tasks" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_logs_insert_policy" ON "public"."activity_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."board_members"
  WHERE (("board_members"."board_id" = "board_members"."board_id") AND ("board_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "activity_logs_select_policy" ON "public"."activity_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."board_members"
  WHERE (("board_members"."board_id" = "activity_logs"."board_id") AND ("board_members"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."board_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "board_members_delete_policy" ON "public"."board_members" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."boards"
  WHERE (("boards"."id" = "board_members"."board_id") AND ("boards"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "board_members_insert_policy" ON "public"."board_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."boards"
  WHERE (("boards"."id" = "board_members"."board_id") AND ("boards"."owner_id" = "auth"."uid"())))));



CREATE POLICY "board_members_select_policy" ON "public"."board_members" FOR SELECT USING (("board_id" IN ( SELECT "public"."get_accessible_boards"("auth"."uid"()) AS "get_accessible_boards")));



ALTER TABLE "public"."boards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "boards_delete_policy" ON "public"."boards" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "boards_insert_policy" ON "public"."boards" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "boards_select_policy" ON "public"."boards" FOR SELECT USING (("id" IN ( SELECT "public"."get_accessible_boards"("auth"."uid"()) AS "get_accessible_boards")));



CREATE POLICY "boards_update_policy" ON "public"."boards" FOR UPDATE USING (("auth"."uid"() = "owner_id"));



ALTER TABLE "public"."columns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "columns_delete_policy" ON "public"."columns" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."board_members"
  WHERE (("board_members"."board_id" = "columns"."board_id") AND ("board_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "columns_insert_policy" ON "public"."columns" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."board_members"
  WHERE (("board_members"."board_id" = "board_members"."board_id") AND ("board_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "columns_select_policy" ON "public"."columns" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."board_members"
  WHERE (("board_members"."board_id" = "columns"."board_id") AND ("board_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "columns_update_policy" ON "public"."columns" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."board_members"
  WHERE (("board_members"."board_id" = "columns"."board_id") AND ("board_members"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_delete" ON "public"."comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "comments_insert" ON "public"."comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "comments_insert_policy" ON "public"."comments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."tasks" "t"
     JOIN "public"."columns" "c" ON (("t"."column_id" = "c"."id")))
     JOIN "public"."board_members" "bm" ON (("c"."board_id" = "bm"."board_id")))
  WHERE (("t"."id" = "comments"."task_id") AND ("bm"."user_id" = "auth"."uid"())))));



CREATE POLICY "comments_select" ON "public"."comments" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "comments_select_policy" ON "public"."comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."tasks" "t"
     JOIN "public"."columns" "c" ON (("t"."column_id" = "c"."id")))
     JOIN "public"."board_members" "bm" ON (("c"."board_id" = "bm"."board_id")))
  WHERE (("t"."id" = "comments"."task_id") AND ("bm"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_delete_policy" ON "public"."tasks" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."columns" "c"
     JOIN "public"."board_members" "bm" ON (("c"."board_id" = "bm"."board_id")))
  WHERE (("c"."id" = "tasks"."column_id") AND ("bm"."user_id" = "auth"."uid"())))));



CREATE POLICY "tasks_insert_policy" ON "public"."tasks" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."columns" "c"
     JOIN "public"."board_members" "bm" ON (("c"."board_id" = "bm"."board_id")))
  WHERE (("c"."id" = "tasks"."column_id") AND ("bm"."user_id" = "auth"."uid"())))));



CREATE POLICY "tasks_select_policy" ON "public"."tasks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."columns" "c"
     JOIN "public"."board_members" "bm" ON (("c"."board_id" = "bm"."board_id")))
  WHERE (("c"."id" = "tasks"."column_id") AND ("bm"."user_id" = "auth"."uid"())))));



CREATE POLICY "tasks_update_policy" ON "public"."tasks" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."columns" "c"
     JOIN "public"."board_members" "bm" ON (("c"."board_id" = "bm"."board_id")))
  WHERE (("c"."id" = "tasks"."column_id") AND ("bm"."user_id" = "auth"."uid"())))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."activity_logs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."boards";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."columns";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tasks";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





GRANT ALL ON FUNCTION "public"."get_accessible_boards"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_accessible_boards"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_accessible_boards"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("email_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("email_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("email_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_tasks"("p_task_id" "uuid", "p_target_column_id" "uuid", "p_new_position" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_tasks"("p_task_id" "uuid", "p_target_column_id" "uuid", "p_new_position" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_tasks"("p_task_id" "uuid", "p_target_column_id" "uuid", "p_new_position" integer) TO "service_role";







GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."board_members" TO "anon";
GRANT ALL ON TABLE "public"."board_members" TO "authenticated";
GRANT ALL ON TABLE "public"."board_members" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."board_members_with_emails" TO "anon";
GRANT ALL ON TABLE "public"."board_members_with_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."board_members_with_emails" TO "service_role";



GRANT ALL ON TABLE "public"."boards" TO "anon";
GRANT ALL ON TABLE "public"."boards" TO "authenticated";
GRANT ALL ON TABLE "public"."boards" TO "service_role";



GRANT ALL ON TABLE "public"."columns" TO "anon";
GRANT ALL ON TABLE "public"."columns" TO "authenticated";
GRANT ALL ON TABLE "public"."columns" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

