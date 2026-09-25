import { getSessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "OpenAI API key is missing. Please configure OPENAI_API_KEY in your environment (.env).",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob) || file.size === 0) {
      return new Response(JSON.stringify({ error: "No audio file provided." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const maxSizeBytes = 25 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return new Response(
        JSON.stringify({ error: "Audio file too large. Maximum size is 25MB." }),
        {
          status: 413,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const openAiFormData = new FormData();
    const fileName =
      file instanceof File && file.name ? file.name : "audio.webm";
    openAiFormData.append("file", file, fileName);
    openAiFormData.append("model", "gpt-transcribe");

    const openAiResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: openAiFormData,
      }
    );

    if (!openAiResponse.ok) {
      const errorData = await openAiResponse.json().catch(() => ({}));
      const message =
        (errorData as { error?: { message?: string } })?.error?.message ||
        `OpenAI transcription failed with status ${openAiResponse.status}`;

      return new Response(JSON.stringify({ error: message }), {
        status:
          openAiResponse.status >= 400 && openAiResponse.status < 600
            ? openAiResponse.status
            : 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = (await openAiResponse.json()) as { text?: string };
    return new Response(JSON.stringify({ text: data.text || "" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal transcription error.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
