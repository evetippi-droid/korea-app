export default async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    return;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/korea_keel?select=id&limit=1`,
      {
        method: "GET",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      }
    );

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `Supabase keep-alive failed: ${response.status} ${response.statusText}`,
        body
      );
      return;
    }

    console.log("Supabase keep-alive OK:", new Date().toISOString());
  } catch (error) {
    console.error("Supabase keep-alive error:", error);
  }
};

export const config = {
  schedule: "0 */8 * * *",
};