require("dotenv").config({ path: "D:/F2H/.env" });

const { createClient } = require("@supabase/supabase-js");
const readline = require("node:readline");

const url = process.env.SUPABASE_URL;
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing Supabase URL or public anon key.");
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Admin email: ", (email) => {
  rl.question("Admin password (visible while typing): ", async (password) => {
    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      console.log(
        error
          ? "AUTH TEST FAILED: " + error.message
          : "AUTH TEST PASSED: Supabase session established."
      );

      if (data?.session) {
        await supabase.auth.signOut();
      }
    } finally {
      rl.close();
    }
  });
});
