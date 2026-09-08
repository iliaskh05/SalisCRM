import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Mic, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDemoStore } from "@/lib/demo/store";
import { PageTitle } from "@/demo/ui";
import { formatDateTime } from "@/lib/format";

export function DemoChatPage() {
  const { state, currentUser, addMessage, markConversationRead, createConversation } = useDemoStore();
  const [params, setParams] = useSearchParams();
  const activeId = params.get("c") ?? state.conversations[0]?.id ?? "";
  const [query, setQuery] = useState("");
  const [body, setBody] = useState("");
  const [recording, setRecording] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [confirmNew, setConfirm] = useState(false);

  useEffect(() => {
    if (activeId) markConversationRead(activeId);
  }, [activeId, markConversationRead]);

  const conversations = state.conversations.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()));
  const messages = state.messages.filter((m) => m.conversationId === activeId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const active = state.conversations.find((c) => c.id === activeId);

  async function startRec() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Enregistrement audio non supporté par ce navigateur");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 200) { toast.error("Enregistrement vide"); return; }
        setPreviewUrl(URL.createObjectURL(blob));
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error("Microphone refusé");
    }
  }

  function sendText() {
    if (!currentUser || !activeId || !body.trim()) return;
    addMessage({ conversationId: activeId, authorId: currentUser.id, body: body.trim(), kind: "text" });
    setBody("");
  }

  function sendFile(file: File) {
    if (!currentUser || !activeId) return;
    const reader = new FileReader();
    reader.onload = () => {
      const kind = file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "file";
      addMessage({ conversationId: activeId, authorId: currentUser.id, body: "", kind, attachmentName: file.name, attachmentUrl: String(reader.result) });
      toast.success("Fichier envoyé");
    };
    reader.onerror = () => toast.error("Échec d’envoi du fichier");
    reader.readAsDataURL(file);
  }

  return (
    <>
      <PageTitle eyebrow="Communication" title="Messages">
        <Button variant="outline" onClick={() => setConfirm(true)}>Nouvelle conversation</Button>
      </PageTitle>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardContent className="p-3">
            <Input placeholder="Rechercher" value={query} onChange={(e) => setQuery(e.target.value)} className="mb-2" />
            {conversations.length === 0 ? <EmptyState title="Aucun message" className="py-8" /> : conversations.map((c) => (
              <button key={c.id} type="button" onClick={() => setParams({ c: c.id })} className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm ${c.id === activeId ? "bg-muted" : "hover:bg-muted/50"}`}>
                <p className="font-medium">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.kind === "intervention" ? "Intervention" : c.kind}</p>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card className="flex min-h-[480px] flex-col">
          <CardContent className="flex flex-1 flex-col p-0">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">{active?.title ?? "Sélectionnez une conversation"}</div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m) => (
                <div key={m.id} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.authorId === currentUser?.id ? "ml-auto bg-teal-50" : "bg-muted"}`}>
                  <p className="text-[11px] text-muted-foreground">{state.users.find((u) => u.id === m.authorId)?.name} · {formatDateTime(m.createdAt)}</p>
                  {m.body ? <p>{m.body}</p> : null}
                  {m.kind === "audio" && m.attachmentUrl ? <audio controls src={m.attachmentUrl} className="mt-1 w-full" /> : null}
                  {m.kind === "image" && m.attachmentUrl ? <img src={m.attachmentUrl} alt="" className="mt-1 max-h-40 rounded" /> : null}
                  {m.attachmentName && m.kind !== "audio" && m.kind !== "image" ? <p className="text-xs">{m.attachmentName}</p> : null}
                </div>
              ))}
            </div>
            {previewUrl ? (
              <div className="flex items-center gap-2 border-t px-3 py-2">
                <audio controls src={previewUrl} />
                <Button size="sm" onClick={() => {
                  if (!currentUser || !activeId) return;
                  addMessage({ conversationId: activeId, authorId: currentUser.id, body: "", kind: "audio", attachmentName: "message-vocal.webm", attachmentUrl: previewUrl });
                  setPreviewUrl(null);
                }}>Envoyer le vocal</Button>
              </div>
            ) : null}
            <div className="flex items-center gap-2 border-t border-border p-3">
              <label className="cursor-pointer rounded-lg border border-border p-2">
                <Paperclip className="size-4" />
                <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && sendFile(e.target.files[0])} />
              </label>
              <Button size="sm" variant={recording ? "accent" : "outline"} onClick={() => {
                if (recording) { recorder.current?.stop(); setRecording(false); } else void startRec();
              }}><Mic className="size-4" /></Button>
              <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Écrire un message…" onKeyDown={(e) => e.key === "Enter" && sendText()} />
              <Button size="sm" variant="accent" onClick={sendText}><Send className="size-4" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog open={confirmNew} onClose={() => setConfirm(false)} title="Créer une conversation d’équipe ?" onConfirm={() => {
        const id = createConversation({ title: "Nouvelle discussion", kind: "group", memberIds: state.users.filter((u) => u.status === "active").map((u) => u.id) });
        setParams({ c: id });
        setConfirm(false);
      }} />
    </>
  );
}
