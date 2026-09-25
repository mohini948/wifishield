import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Mic, MicOff, Send, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { assistantReply } from "@/lib/wifi.functions";
import { cn } from "@/lib/utils";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Explain my current dashboard",
  "Which network is the biggest risk?",
  "How do I secure my router?",
];

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function createRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function Assistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [speakReplies, setSpeakReplies] = useState(true);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm your wireless security assistant. Ask me about your latest scan, or tap the mic and talk to me.",
    },
  ]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ask = useServerFn(assistantReply);

  useEffect(() => {
    setVoiceSupported(createRecognition() !== null);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, open]);

  const speak = (text: string) => {
    if (!speakReplies || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*_#`]/g, ""));
    utterance.rate = 1.02;
    window.speechSynthesis.speak(utterance);
  };

  const mutation = useMutation({
    mutationFn: (messages: Turn[]) => ask({ data: { messages } }),
    onSuccess: (result) => {
      setTurns((prev) => [...prev, { role: "assistant", content: result.reply }]);
      speak(result.reply);
    },
    onError: (error: Error) =>
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: `I hit a problem: ${error.message}` },
      ]),
  });

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean || mutation.isPending) return;
    const next: Turn[] = [...turns, { role: "user", content: clean }];
    setTurns(next);
    setInput("");
    mutation.mutate(next.filter((t) => t.role === "user" || t.content.length > 0).slice(-12));
  };

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = createRecognition();
    if (!recognition) {
      setVoiceSupported(false);
      return;
    }
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) send(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.start();
    setListening(true);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-4 py-3 text-sm font-medium text-primary shadow-lg backdrop-blur transition hover:bg-primary/25"
        aria-label="Open the security assistant"
      >
        <Bot className="size-4" /> Ask the assistant
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[32rem] w-[min(24rem,calc(100vw-2.5rem))] flex-col rounded-lg border border-border bg-card/95 shadow-2xl backdrop-blur">
      <header className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <Bot className="size-4 text-primary" />
        <span className="text-sm font-semibold">Security assistant</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => {
              setSpeakReplies((v) => !v);
              window.speechSynthesis?.cancel();
            }}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={speakReplies ? "Mute spoken replies" : "Speak replies aloud"}
          >
            {speakReplies ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
          <button
            onClick={() => {
              window.speechSynthesis?.cancel();
              setOpen(false);
            }}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close assistant"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {turns.map((turn, i) => (
          <div
            key={i}
            className={cn(
              "whitespace-pre-wrap rounded-md px-3 py-2 text-sm leading-relaxed",
              turn.role === "user"
                ? "ml-8 bg-primary/15 text-foreground"
                : "mr-4 bg-secondary/60 text-foreground",
            )}
          >
            {turn.content}
          </div>
        ))}
        {mutation.isPending ? (
          <p className="label-mono animate-pulse">Analyzing your airspace…</p>
        ) : null}
        {turns.length === 1 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border/70 p-3"
      >
        <button
          type="button"
          onClick={toggleMic}
          disabled={!voiceSupported}
          title={voiceSupported ? "Talk to the assistant" : "Voice input is not supported in this browser"}
          className={cn(
            "rounded-md border border-border p-2 transition",
            listening ? "border-crit/50 bg-crit/15 text-crit" : "text-muted-foreground hover:text-foreground",
            !voiceSupported && "opacity-40",
          )}
        >
          {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? "Listening…" : "Ask about your scan…"}
          className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
        />
        <Button type="submit" size="sm" disabled={mutation.isPending || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
