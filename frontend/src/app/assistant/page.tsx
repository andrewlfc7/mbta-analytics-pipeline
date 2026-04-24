"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { clientPost } from "@/lib/api";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Bus,
  Info,
  Loader2,
  MessageSquareText,
  Send,
  Ship,
  Sparkles,
  Train,
  TrainFront,
} from "lucide-react";

interface AssistantResponse {
  kind: string;
  answer: string;
  cards: {
    title: string;
    value: string;
    detail?: string;
    tone?: string;
  }[];
  items: {
    title: string;
    detail?: string;
    meta?: string;
    tone?: string;
  }[];
  suggestions: string[];
}

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; response: AssistantResponse };

const starterQuestions = [
  "What are the biggest delays right now?",
  "Are buses running normally in Somerville?",
  "How is weather affecting service?",
  "What's the best route from Back Bay to Harvard?",
];

const favoriteTrips = [
  {
    icon: Bus,
    title: "Home → Work",
    detail: "Belmont Center → Downtown Crossing",
    typical: "Typical 38 min",
  },
  {
    icon: TrainFront,
    title: "Back Bay → Airport",
    detail: "Back Bay → Airport",
    typical: "Typical 28 min",
  },
  {
    icon: Train,
    title: "North Station → Salem",
    detail: "North Station → Salem",
    typical: "Typical 32 min",
  },
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(starterQuestions);

  useEffect(() => {
    void submitQuestion("Give me a quick overview of the network right now.", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latestAssistant = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message): message is Extract<ChatMessage, { role: "assistant" }> => message.role === "assistant"),
    [messages]
  );

  async function submitQuestion(question: string, appendUser = true) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    if (appendUser) {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "user", text: trimmed },
      ]);
    }

    setLoading(true);
    setInput("");

    try {
      const response = await clientPost<AssistantResponse>("/assistant/query", {
        message: trimmed,
      });
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", response },
      ]);
      if (response.suggestions?.length) {
        setSuggestions(response.suggestions);
      }
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          response: {
            kind: "error",
            answer:
              "I couldn't reach the assistant backend just now. Please try again in a moment.",
            cards: [],
            items: [],
            suggestions: starterQuestions,
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-5xl font-semibold tracking-tight text-white">
          Transit Assistant
        </h1>
        <p className="mt-2 text-[18px] text-slate-400">
          Ask questions about routes, delays, alerts, and the best way to travel.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <DashboardCard variant="light" title="Assistant Feed">
            <div className="mb-5 flex flex-wrap gap-2">
              {[
                { label: "All Modes", icon: TrainFront },
                { label: "Bus", icon: Bus },
                { label: "Subway", icon: TrainFront },
                { label: "Commuter Rail", icon: Train },
                { label: "Ferry", icon: Ship },
              ].map((item, index) => (
                <button
                  key={item.label}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[13px] font-medium ${
                    index === 0
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              ))}
            </div>

            <div className="space-y-5">
              {messages.map((message) =>
                message.role === "user" ? (
                  <UserBubble key={message.id} text={message.text} />
                ) : (
                  <AssistantBlock key={message.id} response={message.response} />
                )
              )}

              {loading && (
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    Thinking through the latest MBTA data...
                  </div>
                </div>
              )}
            </div>

            <form
              className="mt-6 rounded-[22px] border border-slate-200 bg-slate-50 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitQuestion(input);
              }}
            >
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <MessageSquareText className="h-4 w-4 text-blue-600" />
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about routes, alerts, or service..."
                  className="flex-1 bg-transparent text-[14px] text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:bg-slate-300"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-3 text-[12px] text-slate-400">
                Responses are generated from live MBTA analytics data and may not always be complete.
              </p>
            </form>
          </DashboardCard>
        </div>

        <div className="space-y-4 xl:col-span-5">
          <DashboardCard variant="light" title="Try Asking">
            <div className="space-y-3">
              {suggestions.map((question) => (
                <button
                  key={question}
                  onClick={() => void submitQuestion(question)}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left text-[13px] text-slate-600 transition-colors hover:bg-slate-50"
                >
                  {question}
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                </button>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard variant="light" title="Latest Insight">
            {latestAssistant ? (
              <div className="space-y-4">
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[15px] font-medium leading-7 text-slate-700">
                    {latestAssistant.response.answer}
                  </p>
                </div>
                {latestAssistant.response.cards.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {latestAssistant.response.cards.slice(0, 4).map((card) => (
                      <InsightCard key={`${card.title}-${card.value}`} card={card} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-slate-500">
                Ask a question to get a live summary here.
              </p>
            )}
          </DashboardCard>

          <DashboardCard
            variant="light"
            title="Favorite Trips"
            action={<span className="text-[12px] text-blue-600">Manage</span>}
          >
            <div className="space-y-3">
              {favoriteTrips.map((trip) => (
                <div
                  key={trip.title}
                  className="rounded-2xl border border-slate-200 px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-blue-600">
                      <trip.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-slate-900">
                        {trip.title}
                      </p>
                      <p className="mt-0.5 text-[12px] text-slate-500">{trip.detail}</p>
                      <p className="mt-1 text-[12px] text-slate-400">{trip.typical}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl bg-blue-50 px-4 py-3 text-[14px] font-medium text-blue-700">
        {text}
      </div>
    </div>
  );
}

function AssistantBlock({ response }: { response: AssistantResponse }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Bot className="h-4 w-4" />
        </div>
        <p className="max-w-[85%] pt-1 text-[14px] leading-7 text-slate-700">
          {response.answer}
        </p>
      </div>

      {(response.cards.length > 0 || response.items.length > 0) && (
        <div className="ml-12 space-y-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          {response.cards.length > 0 && (
            <div className="grid gap-3 md:grid-cols-3">
              {response.cards.map((card) => (
                <InsightCard key={`${card.title}-${card.value}`} card={card} />
              ))}
            </div>
          )}

          {response.items.length > 0 && (
            <div className="space-y-3">
              {response.items.map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  className="rounded-2xl border border-slate-200 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-slate-900">
                        {item.title}
                      </p>
                      {item.detail && (
                        <p className="mt-1 text-[12px] text-slate-500">
                          {item.detail}
                        </p>
                      )}
                    </div>
                    {item.meta && (
                      <span
                        className={`shrink-0 text-[12px] font-medium ${
                          item.tone === "warning"
                            ? "text-orange-500"
                            : item.tone === "positive"
                              ? "text-emerald-600"
                              : "text-slate-500"
                        }`}
                      >
                        {item.meta}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InsightCard({
  card,
}: {
  card: AssistantResponse["cards"][number];
}) {
  const toneClasses =
    card.tone === "positive"
      ? "text-emerald-600"
      : card.tone === "warning"
        ? "text-orange-500"
        : "text-slate-900";

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {card.tone === "warning" ? (
          <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
        ) : card.tone === "positive" ? (
          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Info className="h-3.5 w-3.5 text-blue-500" />
        )}
        {card.title}
      </div>
      <p className={`mt-3 text-[24px] font-semibold ${toneClasses}`}>{card.value}</p>
      {card.detail && <p className="mt-1 text-[12px] text-slate-500">{card.detail}</p>}
    </div>
  );
}
