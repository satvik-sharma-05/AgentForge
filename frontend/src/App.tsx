import { Component, Fragment, useEffect, useRef, useState } from "react";
import { api, stream, BASE } from "./api";
import { Icon } from "./icons";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const NAV = [
  ["Dashboard", "grid"], ["Agents", "bot"], ["Chat", "chat"], ["Credentials", "key"],
  ["MCP Servers", "plug"], ["Approvals", "shield"], ["History", "history"],
];
const MODELS = { groq: "openai/gpt-oss-120b", gemini: "gemini-2.5-flash", ollama: "llama3.1" };
const BLANK = { name: "", description: "", avatar: "🤖", prompt: "You are a helpful assistant.", provider: "groq", model: MODELS.groq,
  temperature: 0.7, max_tokens: 8192, tools: [], memory: true, rag: false, active: true };

// ---------- small helpers ----------
let pushToast: (msg: string, kind?: string) => void = () => {};
export const toast = (m: string, k = "ok") => pushToast(m, k);
const fail = (e: any) => toast(e?.message || String(e), "err");

function useLoad<T = any>(fn: () => Promise<T>, deps: any[] = []) {
  const [v, set] = useState<T>(null);
  const reload = () => { fn().then(set).catch(fail); };
  useEffect(() => { reload(); }, deps);
  return [v, reload] as const;
}

const Text = ({ t }: { t: string }) => (
  <div className="md"><Markdown remarkPlugins={[remarkGfm]}
    components={{ a: ({ node, href, ...p }) => <a {...p} href={href?.startsWith("/files/") ? BASE + href : href} target="_blank" rel="noreferrer" /> }}>
    {(t || "").replace(/【[^】]*】/g, "").replace(/(^|\s)(\/files\/\S+)/g, "$1[$2]($2)")}
  </Markdown></div>
);
const Json = ({ v }) => <pre className="code">{typeof v === "string" ? v : JSON.stringify(v, null, 2)}</pre>;
const Empty = ({ icon, title, children = null }) => (
  <div className="empty"><Icon name={icon} size={28} /><h3>{title}</h3>{children}</div>
);
const when = (d) => (d ? new Date(d + (String(d).endsWith("Z") ? "" : "Z")).toLocaleString() : "");

class Boundary extends Component<{ children: any; reset: any }, { err: any }> {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  componentDidUpdate(p) { if (p.reset !== this.props.reset && this.state.err) this.setState({ err: null }); }
  render() {
    return this.state.err ? (
      <Empty icon="x" title="This page hit an error">
        <p className="muted">{String(this.state.err.message || this.state.err)}</p>
        <button className="btn" onClick={() => this.setState({ err: null })}>Try again</button>
      </Empty>
    ) : this.props.children;
  }
}

// ---------- app shell ----------
export default function App() {
  const [tok, setTok] = useState(localStorage.getItem("t"));
  const [page, setPage] = useState("Dashboard");
  const [toasts, setToasts] = useState<any[]>([]);
  pushToast = (msg, kind = "ok") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };
  const toastEl = <div className="toasts">{toasts.map((t) => <div key={t.id} className={"toast " + t.kind}>{t.msg}</div>)}</div>;
  if (!tok) return <>{toastEl}<Auth done={(t) => { localStorage.setItem("t", t); setTok(t); }} /></>;
  const Page = { Dashboard, Agents, Chat, Credentials, "MCP Servers": MCP, Approvals, History }[page];
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="mark">AF</span>AgentForge</div>
        <nav>{NAV.map(([n, i]) => (
          <button key={n} className={"nav" + (n === page ? " active" : "")} onClick={() => setPage(n)}><Icon name={i} />{n}</button>))}
        </nav>
        <button className="nav" onClick={() => { localStorage.removeItem("t"); setTok(null); }}><Icon name="logout" />Sign out</button>
      </aside>
      <main className="main"><Boundary reset={page}><Page go={setPage} /></Boundary></main>
      {toastEl}
    </div>
  );
}

function Auth({ done }) {
  const [mode, setMode] = useState<"login" | "register">(location.hash === "#register" ? "register" : "login");
  const [f, setF] = useState({ name: "", email: "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const reg = mode === "register";
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (reg && f.password.length < 8) return setErr("Password must be at least 8 characters.");
    if (reg && f.password !== f.confirm) return setErr("Passwords do not match.");
    setBusy(true);
    try {
      const body = reg ? { name: f.name, email: f.email, password: f.password } : { email: f.email, password: f.password };
      done((await api("/auth/" + mode, "POST", body)).access_token);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const field = (k, label, type = "text", auto = "") => (
    <div className="field"><label htmlFor={"a-" + k}>{label}</label>
      <input id={"a-" + k} required type={type} autoComplete={auto} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  return (
    <div className="auth">
      <div className="auth-side">
        <div className="brand light"><span className="mark">AF</span>AgentForge</div>
        <h1>Create. Connect. Automate.</h1>
        <p>Build AI agents with your own tools, connect services over MCP, and approve every sensitive action before it runs.</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h2>{reg ? "Create your account" : "Sign in"}</h2>
        <p className="muted">{reg ? "Start building agents in minutes." : "Welcome back."}</p>
        {reg && field("name", "Full name", "text", "name")}
        {field("email", "Email", "email", "email")}
        {field("password", "Password", "password", reg ? "new-password" : "current-password")}
        {reg && field("confirm", "Confirm password", "password", "new-password")}
        {err && <div className="alert">{err}</div>}
        <button className="btn wide" disabled={busy}>{busy ? "Please wait…" : reg ? "Create account" : "Sign in"}</button>
        <p className="muted center">{reg ? "Already have an account? " : "New to AgentForge? "}
          <a href="#" onClick={(e) => { e.preventDefault(); setErr(""); setMode(reg ? "login" : "register"); }}>{reg ? "Sign in" : "Create an account"}</a></p>
      </form>
    </div>
  );
}

const Header = ({ title, sub = "", children = null }) => (
  <div className="page-head"><div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div><div className="row">{children}</div></div>
);

// ---------- dashboard ----------
function Dashboard({ go }) {
  const [s] = useLoad(() => api("/stats"));
  if (!s) return null;
  const tiles = [["Agents", s.agents, "Agents"], ["Conversations", s.conversations, "Chat"], ["Saved credentials", s.integrations, "Credentials"],
    ["Pending approvals", s.pending_approvals, "Approvals"], ["Tool executions", s.executions, "History"]];
  return (
    <>
      <Header title="Dashboard" sub="Overview of your agents and activity." />
      <div className="stats">{tiles.map(([k, v, to]) => (
        <button key={k} className={"stat" + (to === "Approvals" && v ? " hot" : "")} onClick={() => go(to)}>
          <span className="muted">{k}</span><strong>{v}</strong></button>))}
      </div>
      <section className="panel">
        <h3>Recent tool executions</h3>
        {s.recent.length ? <ExecTable rows={s.recent} /> : <p className="muted">No tool calls yet. Start a chat with an agent.</p>}
      </section>
    </>
  );
}

const ExecTable = ({ rows }) => (
  <div className="table-wrap"><table>
    <thead><tr><th>Tool</th><th>Status</th><th>Latency</th><th>Time</th></tr></thead>
    <tbody>{rows.map((e) => (
      <tr key={e.id}><td className="mono">{e.tool}</td><td><span className={"pill " + (e.status === "success" ? "good" : "bad")}>{e.status}</span></td>
        <td className="num">{e.latency_ms} ms</td><td className="muted">{when(e.created)}</td></tr>))}</tbody>
  </table></div>
);

// ---------- credentials UI (shared) ----------
function CredFields({ fields, saved = {}, value = {}, onChange }) {
  if (!fields.length) return <p className="muted small">No setup needed.</p>;
  return (
    <div className="cred-grid">{fields.map((f) => {
      const has = !!saved?.[f.key];
      const v = value?.[f.key] ?? (!f.secret && has ? saved[f.key] : "");
      return (
        <div className="field" key={f.key}>
          <label>{f.label} {f.optional ? <span className="tag">optional</span> : has ? <span className="tag ok">saved</span> : <span className="tag need">required</span>}</label>
          <input type={f.secret ? "password" : "text"} autoComplete="off" value={v}
            placeholder={f.secret && has ? `Saved ${saved[f.key]} · leave blank to keep` : f.placeholder}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })} />
          {f.help && <span className="help">{f.help}</span>}
        </div>);
    })}</div>
  );
}
const ready = (fields, saved) => fields.every((f) => f.optional || saved?.[f.key]);

async function saveCreds(agentId, drafts) {
  for (const [integ, vals] of Object.entries<any>(drafts))
    if (Object.values(vals || {}).some((v: any) => String(v).trim())) await api(`/agents/${agentId}/credentials/${integ}`, "PUT", vals);
}

// ---------- agents ----------
function Agents() {
  const [list, reload] = useLoad(() => api("/agents"));
  const [edit, setEdit] = useState<any>(null);
  const [graph, setGraph] = useState<any>(null);
  const [del, setDel] = useState<number>(null);
  if (graph) return <Graph agent={graph} close={() => setGraph(null)} />;
  if (edit) return <Editor agent={edit} close={(changed) => { setEdit(null); if (changed) reload(); }} />;
  const act = (p) => p.then(reload).catch(fail);
  return (
    <>
      <Header title="Agents" sub="Configure each agent's instructions, model and tools.">
        <button className="btn" onClick={() => setEdit({ ...BLANK })}><Icon name="plus" />New agent</button>
      </Header>
      {list && !list.length && <Empty icon="bot" title="No agents yet"><button className="btn" onClick={() => setEdit({ ...BLANK })}>Create your first agent</button></Empty>}
      <div className="cards">{(list || []).map((a) => (
        <article className="card" key={a.id}>
          <div className="card-top">
            <span className="avatar">{a.avatar}</span>
            <div className="grow"><h3>{a.name}</h3><span className="muted small">{a.provider} · {a.model}</span></div>
            <span className={"pill " + (a.active ? "good" : "")}>{a.active ? "Active" : "Inactive"}</span>
          </div>
          <p className="desc">{a.description || "No description."}</p>
          <p className="muted small">{a.tools.length} tool actions{a.memory ? " · memory" : ""}{a.rag ? " · documents" : ""}</p>
          {del === a.id ? (
            <div className="row confirm"><span>Delete this agent and its credentials?</span>
              <button className="btn danger sm" onClick={() => { setDel(null); act(api(`/agents/${a.id}`, "DELETE")); }}>Delete</button>
              <button className="btn ghost sm" onClick={() => setDel(null)}>Cancel</button></div>
          ) : (
            <div className="row">
              <button className="btn sm" onClick={() => setEdit(a)}>Edit</button>
              <button className="btn ghost sm" onClick={() => setGraph(a)}><Icon name="graph" size={15} />Graph</button>
              <button className="btn ghost sm" onClick={() => act(api(`/agents/${a.id}/duplicate`, "POST"))}><Icon name="copy" size={15} />Duplicate</button>
              <button className="btn ghost sm" onClick={() => act(api(`/agents/${a.id}`, "PATCH", { active: !a.active }))}>{a.active ? "Deactivate" : "Activate"}</button>
              <button className="icon-btn" title="Delete" onClick={() => setDel(a.id)}><Icon name="trash" size={16} /></button>
            </div>)}
        </article>))}
      </div>
    </>
  );
}

function Editor({ agent, close }) {
  const [f, setF] = useState<any>(agent);
  const [cat] = useLoad(() => api("/integrations"));
  const [saved, setSaved] = useState<any>({});
  const [cr, setCr] = useState<any>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (agent.id) api(`/agents/${agent.id}/credentials`).then(setSaved).catch(fail); }, [agent.id]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const isOn = (t) => t.actions.some((x) => f.tools.includes(x.id));
  const toggle = (t) => {
    const ids = t.actions.map((x) => x.id);
    set("tools", isOn(t) ? f.tools.filter((x) => !ids.includes(x)) : [...new Set([...f.tools, ...ids])]);
  };
  const save = async () => {
    if (!f.name.trim()) return toast("Give the agent a name.", "err");
    setBusy(true);
    try {
      const a = await (f.id ? api(`/agents/${f.id}`, "PATCH", f) : api("/agents", "POST", f));
      await saveCreds(a.id, cr);
      toast("Agent saved"); close(true);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const llm = cat?.llm[f.provider] || [];
  return (
    <>
      <Header title={f.id ? `Edit ${agent.name}` : "New agent"} sub="Changes apply to new messages.">
        <button className="btn ghost" onClick={() => close(false)}>Cancel</button>
        <button className="btn" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save agent"}</button>
      </Header>
      <div className="editor">
        <section className="panel">
          <h3>Basics</h3>
          <div className="row top">
            <div className="field" style={{ width: 80 }}><label>Icon</label><input value={f.avatar} maxLength={4} onChange={(e) => set("avatar", e.target.value)} /></div>
            <div className="field grow"><label>Name</label><input value={f.name} placeholder="Research Assistant" onChange={(e) => set("name", e.target.value)} /></div>
          </div>
          <div className="field"><label>Description</label><input value={f.description} placeholder="What this agent is for" onChange={(e) => set("description", e.target.value)} /></div>
          <div className="field"><label>System prompt</label>
            <textarea rows={6} value={f.prompt} onChange={(e) => set("prompt", e.target.value)} />
            <span className="help">The agent follows these instructions in every reply.</span></div>
        </section>

        <section className="panel">
          <h3>Model</h3>
          <div className="row top">
            <div className="field"><label>Provider</label>
              <select value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value, model: MODELS[e.target.value] })}>
                <option value="groq">Groq</option><option value="gemini">Google Gemini</option><option value="ollama">Ollama (local)</option></select></div>
            <div className="field grow"><label>Model</label><input value={f.model} onChange={(e) => set("model", e.target.value)} /></div>
            <div className="field" style={{ width: 110 }}><label>Temperature</label><input type="number" step="0.1" min="0" max="2" value={f.temperature} onChange={(e) => set("temperature", +e.target.value)} /></div>
            <div className="field" style={{ width: 120 }}><label>Max tokens</label><input type="number" min="1" value={f.max_tokens} onChange={(e) => set("max_tokens", +e.target.value)} /></div>
          </div>
          <CredFields fields={llm} saved={saved[f.provider]} value={cr[f.provider]} onChange={(v) => setCr({ ...cr, [f.provider]: v })} />
          <div className="row">
            {[["memory", "Remember conversation"], ["rag", "Use uploaded documents"], ["active", "Active"]].map(([k, l]) => (
              <label key={k} className="check"><input type="checkbox" checked={f[k]} onChange={(e) => set(k, e.target.checked)} />{l}</label>))}
          </div>
        </section>

        <section className="panel">
          <h3>Tools</h3>
          <p className="muted small">Turn on a tool, then fill in its credentials. Actions marked “approval” wait for your OK before running.</p>
          <div className="tiles">{(cat?.tiles || []).map((t) => {
            const on = isOn(t);
            return (
              <div key={t.id} className={"tile" + (on ? " on" : "")}>
                <button type="button" className="tile-head" aria-pressed={on} onClick={() => toggle(t)}>
                  <span className="tile-icon"><Icon name={t.icon} size={20} /></span>
                  <span className="grow"><b>{t.name}</b><span className="muted small">{t.caption}</span></span>
                  {on && t.fields.length > 0 && <span className={"tag " + (ready(t.fields, { ...saved[t.id], ...cr[t.id] }) ? "ok" : "need")}>
                    {ready(t.fields, { ...saved[t.id], ...cr[t.id] }) ? "Ready" : "Needs setup"}</span>}
                  <span className={"switch" + (on ? " on" : "")} />
                </button>
                {on && (
                  <div className="tile-body">
                    <CredFields fields={t.fields} saved={saved[t.id]} value={cr[t.id]} onChange={(v) => setCr({ ...cr, [t.id]: v })} />
                    {t.note && <p className="help">{t.note}</p>}
                    <div className="actions">{t.actions.map((x) => (
                      <label key={x.id} className="check">
                        <input type="checkbox" checked={f.tools.includes(x.id)}
                          onChange={(e) => set("tools", e.target.checked ? [...f.tools, x.id] : f.tools.filter((y) => y !== x.id))} />
                        {x.id.replace(/^mcp__\d+__/, "").replace(/_/g, " ")}{x.risky && <span className="tag need">approval</span>}
                      </label>))}</div>
                  </div>)}
              </div>);
          })}</div>
        </section>
      </div>
    </>
  );
}

// LangGraph diagram of one agent (graph.get_graph().draw_mermaid() from the backend)
function Graph({ agent, close }) {
  const ref = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    (async () => {
      const { mermaid: code } = await api(`/agents/${agent.id}/graph`);
      if (!live) return;
      setSrc(code);
      const m = (await import("mermaid")).default;
      m.initialize({ startOnLoad: false, theme: "neutral" });
      const { svg } = await m.render("g" + agent.id + Date.now(), code);
      if (live && ref.current) ref.current.innerHTML = svg;
    })().catch(fail);
    return () => { live = false; };
  }, [agent.id]);
  return (
    <>
      <Header title={`${agent.name} · LangGraph`} sub="The agent node (LLM) decides; the tools node runs tools and loops back. Highlighted tools pause with interrupt() for approval.">
        <button className="btn ghost" onClick={close}>Back</button>
      </Header>
      <section className="panel graph" ref={ref}>Loading graph…</section>
      <details className="panel"><summary>Mermaid source</summary><Json v={src} /></details>
    </>
  );
}

// ---------- chat ----------
function toItems(msgs, pend) {
  const out = [];
  for (const m of msgs) {
    if (m.role === "user") out.push({ role: "user", text: m.content });
    if (m.role === "assistant") {
      if (m.content) out.push({ role: "assistant", text: m.content });
      (m.tool_calls || []).forEach((c) => out.push({ role: "tool", name: c.function.name, text: c.function.arguments }));
    }
    if (m.role === "tool") out.push({ role: "result", name: m.name, text: String(m.content).slice(0, 800) });
  }
  return out.concat(pend.map((a) => ({ role: "approval", a })));
}

function Chat() {
  const [agents] = useLoad(() => api("/agents"));
  const [agent, setAgent] = useState<number>(null);
  const [convs, reloadConvs] = useLoad(() => (agent ? api(`/conversations?agent_id=${agent}`) : Promise.resolve([])), [agent]);
  const [conv, setConv] = useState<number>(null);
  const [items, setItems] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<AbortController>(null);
  const end = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { if (agents?.length && !agent) setAgent(agents[0].id); }, [agents]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [items]);
  useEffect(() => () => { busy?.abort(); }, [busy]);

  const load = async (id) => {
    try {
      setConv(id);
      const [m, p] = await Promise.all([api(`/conversations/${id}/messages`), api("/approvals")]);
      setItems(toItems(m, p.filter((a) => a.conversation_id === id)));
    } catch (e) { fail(e); }
  };
  const on = (e) => setItems((it) => {
    const last = it[it.length - 1];
    if (e.type === "token") return last?.live ? [...it.slice(0, -1), { ...last, text: last.text + e.text }] : [...it, { role: "assistant", text: e.text, live: true }];
    if (e.type === "tool") return [...it, { role: "tool", name: e.name, text: JSON.stringify(e.args) }];
    if (e.type === "tool_result") return [...it, { role: "result", name: e.name, text: String(e.result).slice(0, 800) }];
    if (e.type === "approval") return [...it, { role: "approval", a: e }];
    if (e.type === "error") return [...it, { role: "error", text: e.error }];
    return it;
  });
  const run = async (path, body) => {
    const c = new AbortController(); setBusy(c);
    try { await stream(path, body, on, c.signal); } catch (e) { if (e.name !== "AbortError") fail(e); } finally { setBusy(null); }
  };
  const send = async (text = input) => {
    if (!text.trim() || busy || !agent) return;
    try {
      let id = conv;
      if (!id) { id = (await api("/conversations", "POST", { agent_id: agent })).id; setConv(id); reloadConvs(); }
      setInput(""); setItems((it) => [...it, { role: "user", text }]);
      await run(`/conversations/${id}/messages`, { content: text });
    } catch (e) { fail(e); }
  };
  const decide = (a, ok) => { setItems((it) => it.filter((x) => x.a !== a)); run(`/approvals/${a.id}/${ok ? "approve" : "reject"}`, {}); };
  const upload = async (f: File) => {
    try {
      const fd = new FormData(); fd.append("agent_id", String(agent)); fd.append("file", f);
      await api("/documents/upload", "POST", fd); toast(`Uploaded ${f.name}. Turn on “Use uploaded documents” for this agent.`);
    } catch (e) { fail(e); }
  };
  const newChat = () => { setConv(null); setItems([]); };
  if (agents && !agents.length) return <Empty icon="bot" title="Create an agent to start chatting" />;
  const cur = agents?.find((a) => a.id === agent);

  return (
    <div className="chat">
      <aside className="chat-list">
        <select value={agent || ""} onChange={(e) => { setAgent(+e.target.value); newChat(); }}>
          {(agents || []).map((a) => <option key={a.id} value={a.id}>{a.avatar} {a.name}</option>)}</select>
        <button className="btn wide" onClick={newChat}><Icon name="plus" />New chat</button>
        <div className="convs">{(convs || []).map((c) => (
          <div key={c.id} className={"conv" + (c.id === conv ? " active" : "")}>
            <button className="conv-title" onClick={() => load(c.id)}>{c.title}</button>
            <button className="icon-btn" title="Delete chat" onClick={() => api(`/conversations/${c.id}`, "DELETE").then(() => { if (c.id === conv) newChat(); reloadConvs(); }).catch(fail)}>
              <Icon name="x" size={14} /></button>
          </div>))}</div>
      </aside>
      <section className="chat-main">
        <div className="chat-head">{cur && <><span className="avatar sm">{cur.avatar}</span><b>{cur.name}</b><span className="muted small">{cur.model}</span></>}</div>
        <div className="msgs">
          {!items.length && <Empty icon="chat" title="Start a conversation"><p className="muted">Ask anything. The agent uses its tools when needed.</p></Empty>}
          {items.map((m, i) => {
            if (m.role === "approval") return (
              <div key={i} className="approval">
                <div className="row"><Icon name="shield" /><b>Approval needed</b><span className="mono">{m.a.tool}</span></div>
                <Json v={m.a.args} />
                <div className="row"><button className="btn sm" onClick={() => decide(m.a, true)}>Approve</button>
                  <button className="btn ghost sm" onClick={() => decide(m.a, false)}>Reject</button></div>
              </div>);
            if (m.role === "result") return null; // shown inside its tool step
            if (m.role === "tool") {
              const res = items.slice(i + 1).find((x) => x.role === "result" && x.name === m.name);
              return (
                <details key={i} className="step">
                  <summary><Icon name={res ? "check" : "cpu"} size={14} />{res ? "Used" : "Running"} <span className="mono">{m.name}</span></summary>
                  <div className="step-body"><div className="small muted">Input</div><Json v={m.text} />
                    {res && <><div className="small muted">Output</div><Json v={res.text} /></>}</div>
                </details>);
            }
            return <div key={i} className={"msg " + m.role}><Text t={m.text} /></div>;
          })}
          {busy && items[items.length - 1]?.role === "user" && <div className="msg assistant typing">Thinking…</div>}
          <div ref={end} />
        </div>
        <div className="composer">
          <input ref={file} type="file" hidden accept=".pdf,.docx,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          <button className="icon-btn" title="Upload a document" onClick={() => file.current?.click()}><Icon name="paperclip" /></button>
          <input className="grow" value={input} placeholder="Message the agent…" onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          {busy ? <button className="btn ghost" onClick={() => busy.abort()}><Icon name="stop" />Stop</button> : <>
            <button className="icon-btn" title="Retry last message" onClick={() => { const u = [...items].reverse().find((m) => m.role === "user"); if (u) send(u.text); }}><Icon name="retry" /></button>
            <button className="btn" onClick={() => send()}><Icon name="arrow" />Send</button></>}
        </div>
      </section>
    </div>
  );
}

// ---------- credentials page ----------
function Credentials({ go }) {
  const [agents] = useLoad(() => api("/agents"));
  const [cat] = useLoad(() => api("/integrations"));
  if (!agents || !cat) return null;
  return (
    <>
      <Header title="Credentials" sub="Each agent keeps its own keys, encrypted at rest. Secret values stay hidden; type a new value to replace one." />
      {!agents.length && <Empty icon="key" title="No agents yet"><button className="btn" onClick={() => go("Agents")}>Create an agent</button></Empty>}
      {agents.map((a) => <AgentCreds key={a.id} agent={a} cat={cat} />)}
    </>
  );
}

function AgentCreds({ agent, cat }) {
  const [saved, reload] = useLoad(() => api(`/agents/${agent.id}/credentials`), [agent.id]);
  const [draft, setDraft] = useState<any>({});
  if (!saved) return null;
  const rows = [
    { id: agent.provider, name: { groq: "Groq", gemini: "Google Gemini", ollama: "Ollama" }[agent.provider] || agent.provider,
      icon: "cpu", caption: `Language model · ${agent.model}`, fields: cat.llm[agent.provider] || [] },
    ...cat.tiles.filter((t) => t.fields.length && t.actions.some((x) => agent.tools.includes(x.id))),
  ];
  const save = async (id) => {
    try { await saveCreds(agent.id, { [id]: draft[id] || {} }); setDraft((d) => ({ ...d, [id]: undefined })); reload(); toast("Credentials saved"); }
    catch (e) { fail(e); }
  };
  const remove = (id) => api(`/agents/${agent.id}/credentials/${id}`, "DELETE").then(() => { reload(); toast("Credentials removed"); }).catch(fail);
  return (
    <section className="panel">
      <div className="row"><span className="avatar sm">{agent.avatar}</span><h3 className="grow">{agent.name}</h3></div>
      <div className="cred-list">{rows.map((t) => {
        const ok = ready(t.fields, saved[t.id]);
        return (
          <div key={t.id} className="cred-row">
            <div className="row"><span className="tile-icon"><Icon name={t.icon} size={18} /></span>
              <span className="grow"><b>{t.name}</b><span className="muted small">{t.caption}</span></span>
              <span className={"tag " + (ok ? "ok" : "need")}>{ok ? "Ready" : "Needs setup"}</span></div>
            <CredFields fields={t.fields} saved={saved[t.id]} value={draft[t.id]} onChange={(v) => setDraft({ ...draft, [t.id]: v })} />
            {t.note && <p className="help">{t.note}</p>}
            <div className="row">
              <button className="btn sm" onClick={() => save(t.id)}>Save</button>
              {saved[t.id] && <button className="btn ghost sm" onClick={() => remove(t.id)}>Remove</button>}
            </div>
          </div>);
      })}</div>
      {rows.length === 1 && <p className="muted small">No enabled tools need credentials. Turn tools on in Agents → Edit.</p>}
    </section>
  );
}

// ---------- MCP ----------
function MCP() {
  const [list, reload] = useLoad(() => api("/mcp/servers"));
  const [f, setF] = useState({ name: "", url: "", headers: "" });
  const [busy, setBusy] = useState<number>(null);
  const add = async (e) => {
    e.preventDefault();
    try {
      let headers = {};
      if (f.headers.trim()) { try { headers = JSON.parse(f.headers); } catch { return toast("Headers must be valid JSON.", "err"); } }
      await api("/mcp/servers", "POST", { name: f.name, url: f.url, headers });
      setF({ name: "", url: "", headers: "" }); reload(); toast("Server added. Connect it to discover tools.");
    } catch (x) { fail(x); }
  };
  const connect = async (id) => {
    setBusy(id);
    try { await api(`/mcp/servers/${id}/connect`, "POST"); toast("Connected"); } catch (e) { fail(e); } finally { setBusy(null); reload(); }
  };
  return (
    <>
      <Header title="MCP Servers" sub="Connect Model Context Protocol servers. Discovered tools appear as tiles in the agent editor." />
      <form className="panel" onSubmit={add}>
        <h3>Add a server</h3>
        <div className="row top">
          <div className="field"><label>Name</label><input required value={f.name} placeholder="GitHub" onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field grow"><label>Server URL</label><input required value={f.url} placeholder="https://host/mcp  (or …/sse)" onChange={(e) => setF({ ...f, url: e.target.value })} /></div>
        </div>
        <div className="field"><label>Headers <span className="tag">optional</span></label>
          <input value={f.headers} placeholder='{"Authorization": "Bearer ghp_..."}' onChange={(e) => setF({ ...f, headers: e.target.value })} /></div>
        <button className="btn"><Icon name="plus" />Add server</button>
      </form>
      {(list || []).map((s) => (
        <section className="panel" key={s.id}>
          <div className="row"><span className="tile-icon"><Icon name="plug" /></span>
            <span className="grow"><b>{s.name}</b><span className="muted small mono">{s.url}</span></span>
            <span className={"pill " + (s.status === "connected" ? "good" : s.status === "error" ? "bad" : "")}>{s.status}</span>
            <button className="btn sm" disabled={busy === s.id} onClick={() => connect(s.id)}>{busy === s.id ? "Connecting…" : "Connect & discover"}</button>
            <button className="icon-btn" title="Delete" onClick={() => api(`/mcp/servers/${s.id}`, "DELETE").then(reload).catch(fail)}><Icon name="trash" size={16} /></button>
          </div>
          {s.tools.length > 0 && <ul className="tool-list">{s.tools.map((t) => <li key={t.name}><span className="mono">{t.name}</span> <span className="muted small">{t.description}</span></li>)}</ul>}
        </section>))}
    </>
  );
}

// ---------- approvals & history ----------
function Approvals() {
  const [st, setSt] = useState("pending");
  const [list, reload] = useLoad(() => api(`/approvals?status=${st}`), [st]);
  const go = async (id, ok) => {
    try { await stream(`/approvals/${id}/${ok ? "approve" : "reject"}`, {}, (e) => { if (e.type === "error") toast(e.error, "err"); }); toast(ok ? "Approved" : "Rejected"); }
    catch (e) { fail(e); } finally { reload(); }
  };
  return (
    <>
      <Header title="Approvals" sub="Sensitive actions wait here until you approve or reject them.">
        <div className="seg">{["pending", "all"].map((s) => <button key={s} className={st === s ? "on" : ""} onClick={() => setSt(s)}>{s === "pending" ? "Pending" : "All"}</button>)}</div>
      </Header>
      {list && !list.length && <Empty icon="shield" title="Nothing waiting for approval" />}
      {(list || []).map((a) => (
        <section className="panel" key={a.id}>
          <div className="row"><span className="mono grow">{a.tool}</span>
            <span className={"pill " + (a.status === "approved" ? "good" : a.status === "pending" ? "warn" : "bad")}>{a.status}</span>
            <span className="muted small">{when(a.created)}</span></div>
          <Json v={a.args} />
          {a.status === "pending" && <div className="row"><button className="btn sm" onClick={() => go(a.id, true)}>Approve</button>
            <button className="btn ghost sm" onClick={() => go(a.id, false)}>Reject</button></div>}
        </section>))}
    </>
  );
}

function History() {
  const [list] = useLoad(() => api("/executions"));
  const [open, setOpen] = useState<number>(null);
  return (
    <>
      <Header title="History" sub="Every tool call with its arguments (secrets redacted), result and latency." />
      {list && !list.length && <Empty icon="history" title="No tool calls yet" />}
      {list?.length > 0 && <div className="panel table-wrap"><table>
        <thead><tr><th>Tool</th><th>Status</th><th>Latency</th><th>Time</th><th /></tr></thead>
        <tbody>{list.map((e) => (<Fragment key={e.id}>
          <tr key={e.id}><td className="mono">{e.tool}</td><td><span className={"pill " + (e.status === "success" ? "good" : "bad")}>{e.status}</span></td>
            <td className="num">{e.latency_ms} ms</td><td className="muted">{when(e.created)}</td>
            <td><button className="btn ghost sm" onClick={() => setOpen(open === e.id ? null : e.id)}>{open === e.id ? "Hide" : "Details"}</button></td></tr>
          {open === e.id && <tr key={e.id + "d"}><td colSpan={5}><b className="small">Arguments</b><Json v={e.args} /><b className="small">Result</b><Json v={e.result} /></td></tr>}
        </Fragment>))}</tbody>
      </table></div>}
    </>
  );
}
