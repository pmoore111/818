import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  MessageSquare,
  Send,
  Plus,
  Trash2,
  Sparkles,
  User,
  Bot,
  TrendingUp,
  CreditCard,
  PiggyBank,
  Target,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Conversation, Message, Account, Transaction, Obligation } from "@shared/schema";

const suggestionChips = [
  { label: "Analyze my spending", icon: TrendingUp },
  { label: "Credit score tips", icon: CreditCard },
  { label: "How can I save more?", icon: PiggyBank },
  { label: "Budget recommendations", icon: Target },
];

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
      data-testid={`message-${message.id}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-primary" : "bg-muted"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary-foreground" />
        ) : (
          <Bot className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div
        className={`flex flex-col max-w-[80%] ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`rounded-2xl px-4 py-2 ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        <span className="text-xs text-muted-foreground mt-1">
          {format(parseISO(message.createdAt?.toString() || new Date().toISOString()), "h:mm a")}
        </span>
      </div>
    </div>
  );
}

function StreamingMessage({ content }: { content: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col items-start max-w-[80%]">
        <div className="rounded-2xl px-4 py-2 bg-muted text-foreground">
          <p className="text-sm whitespace-pre-wrap">{content}</p>
          <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-1" />
        </div>
      </div>
    </div>
  );
}

function ConversationItem({
  conversation,
  isActive,
  onClick,
  onDelete,
}: {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive ? "bg-sidebar-accent" : "hover-elevate"
      }`}
      onClick={onClick}
      data-testid={`conversation-${conversation.id}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm truncate">{conversation.title}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        data-testid={`button-delete-conversation-${conversation.id}`}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

export default function Assistant() {
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: conversations, isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: activeConversation } = useQuery<Conversation & { messages: Message[] }>({
    queryKey: ["/api/conversations", activeConversationId],
    enabled: !!activeConversationId,
  });

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: transactions } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: obligations } = useQuery<Obligation[]>({
    queryKey: ["/api/obligations"],
  });

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/conversations", { title: "New Chat" });
    },
    onSuccess: async (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      const data = await response.json();
      setActiveConversationId(data.id);
    },
    onError: () => {
      toast({ title: "Failed to create conversation", variant: "destructive" });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (activeConversationId === deleteConversationMutation.variables) {
        setActiveConversationId(null);
      }
      toast({ title: "Conversation deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete conversation", variant: "destructive" });
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages, streamingContent]);

  const buildFinancialContext = () => {
    const personalAccounts = accounts?.filter((a) => a.type === "personal") || [];
    const businessAccounts = accounts?.filter((a) => a.type === "business") || [];
    const recentTransactions = transactions?.slice(0, 20) || [];
    const pendingObligations = obligations?.filter((o) => !o.isPaid) || [];

    const personalBalance = personalAccounts.reduce(
      (sum, a) => sum + parseFloat(a.balance),
      0
    );
    const businessBalance = businessAccounts.reduce(
      (sum, a) => sum + parseFloat(a.balance),
      0
    );

    const spendingByCategory: Record<string, number> = {};
    recentTransactions
      .filter((t) => parseFloat(t.amount) < 0)
      .forEach((t) => {
        const cat = t.subcategory || "Other";
        spendingByCategory[cat] = (spendingByCategory[cat] || 0) + Math.abs(parseFloat(t.amount));
      });

    return `
Financial Context:
- Personal Accounts: ${personalAccounts.length} (Total: $${personalBalance.toFixed(2)})
- Business Accounts: ${businessAccounts.length} (Total: $${businessBalance.toFixed(2)})
- Credit Scores: ${accounts?.filter((a) => a.creditScore).map((a) => `${a.name}: ${a.creditScore}`).join(", ") || "None recorded"}
- Recent Spending Categories: ${Object.entries(spendingByCategory).map(([k, v]) => `${k}: $${v.toFixed(2)}`).join(", ") || "None"}
- Pending Obligations: ${pendingObligations.length} totaling $${pendingObligations.reduce((s, o) => s + parseFloat(o.amount), 0).toFixed(2)}
`.trim();
  };

  const sendMessage = async (content: string) => {
    if (!activeConversationId || !content.trim() || isStreaming) return;

    setInputValue("");
    setIsStreaming(true);
    setStreamingContent("");

    queryClient.setQueryData(
      ["/api/conversations", activeConversationId],
      (old: (Conversation & { messages: Message[] }) | undefined) => {
        if (!old) return old;
        return {
          ...old,
          messages: [
            ...old.messages,
            {
              id: Date.now(),
              conversationId: activeConversationId,
              role: "user",
              content,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }
    );

    try {
      const financialContext = buildFinancialContext();
      const fullMessage = `${financialContext}\n\nUser question: ${content}`;

      const response = await fetch(`/api/conversations/${activeConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: fullMessage }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response body");

      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                accumulatedContent += data.content;
                setStreamingContent(accumulatedContent);
              }
              if (data.done) {
                setIsStreaming(false);
                setStreamingContent("");
                queryClient.invalidateQueries({
                  queryKey: ["/api/conversations", activeConversationId],
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      setIsStreaming(false);
      setStreamingContent("");
      toast({ title: "Failed to send message", variant: "destructive" });
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (!activeConversationId) {
      createConversationMutation.mutate();
      setTimeout(() => {
        setInputValue(suggestion);
      }, 500);
    } else {
      sendMessage(suggestion);
    }
  };

  return (
    <div className="flex h-full">
      <div className="w-64 border-r flex flex-col bg-sidebar">
        <div className="p-4 border-b">
          <Button
            className="w-full"
            onClick={() => createConversationMutation.mutate()}
            disabled={createConversationMutation.isPending}
            data-testid="button-new-conversation"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1 p-2">
          {conversationsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : conversations && conversations.length > 0 ? (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onClick={() => setActiveConversationId(conv.id)}
                  onDelete={() => deleteConversationMutation.mutate(conv.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">No conversations yet</p>
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {activeConversationId ? (
          <>
            <div className="border-b p-4">
              <h2 className="font-semibold">
                {activeConversation?.title || "Chat"}
              </h2>
              <p className="text-sm text-muted-foreground">
                AI-powered financial insights
              </p>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl mx-auto space-y-4">
                {activeConversation?.messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                {isStreaming && streamingContent && (
                  <StreamingMessage content={streamingContent} />
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div className="border-t p-4">
              <div className="max-w-3xl mx-auto">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage(inputValue);
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask about your finances..."
                    disabled={isStreaming}
                    data-testid="input-chat-message"
                  />
                  <Button
                    type="submit"
                    disabled={!inputValue.trim() || isStreaming}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">AI Financial Assistant</h2>
            <p className="text-muted-foreground text-center max-w-md mb-8">
              Get personalized insights about your spending habits, credit improvement tips, and
              budgeting advice based on your financial data.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              {suggestionChips.map((chip) => (
                <Button
                  key={chip.label}
                  variant="outline"
                  className="h-auto py-3 px-4 justify-start"
                  onClick={() => handleSuggestionClick(chip.label)}
                  data-testid={`suggestion-${chip.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <chip.icon className="h-4 w-4 mr-2 shrink-0" />
                  <span className="text-sm">{chip.label}</span>
                </Button>
              ))}
            </div>
            <Button
              className="mt-6"
              onClick={() => createConversationMutation.mutate()}
              disabled={createConversationMutation.isPending}
              data-testid="button-start-chat"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Start a Conversation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
