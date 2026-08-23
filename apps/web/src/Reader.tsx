import { useState } from "react";
import { IoCloseOutline } from "react-icons/io5";
import type { Language, Text } from "../../../shared/types/types";
import { roman, pageLabelMap, displayLines } from "../../../shared/reader";

function FolioChip({ label }: { label: string }) {
  return (
    <span className="inline-block font-title text-[11px] text-accent dark:text-accent-dk border-[0.5px] border-accent dark:border-accent-dk rounded-[20px] px-2 py-px mx-[5px] align-middle whitespace-nowrap">
      ❁ {label}
    </span>
  );
}

function BarBtn({
  on, disabled, onClick, children,
}: { on: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex-1 flex items-center justify-center gap-1.5 border-[0.5px] rounded-[10px] px-1.5 py-2",
        "cursor-pointer font-title text-[14px] transition-colors disabled:opacity-40 disabled:cursor-default",
        on
          ? "bg-accent dark:bg-accent-dk text-parchment dark:text-parchment-dk border-accent dark:border-accent-dk"
          : "text-ink-muted border-stone dark:border-bdr-dk bg-transparent",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function Reader({ text, lang, onClose }: { text: Text; lang: Language; onClose: () => void }) {
  const [scheme, setScheme] = useState<string>(lang.defaultScheme);
  const [sound, setSound] = useState(false);
  const [layout, setLayout] = useState<"under" | "line">("under");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const pages = pageLabelMap(text);
  const under = sound && layout === "under";
  const tappable = sound && layout === "line";
  const toggleLine = (li: number) =>
    setRevealed((prev) => {
      const n = new Set(prev);
      n.has(li) ? n.delete(li) : n.add(li);
      return n;
    });
  const cycleScheme = () => {
    const i = lang.schemes.findIndex((s) => s.id === scheme);
    setScheme(lang.schemes[(i + 1) % lang.schemes.length].id);
  };
  const schemeLabel = lang.schemes.find((s) => s.id === scheme)?.label ?? scheme;
  const tokCount = text.lines.reduce((a, l) => a + l.length, 0);

  return (
    <div className="fixed inset-0 z-50 bg-parchment dark:bg-parchment-dk flex flex-col">
      {/* header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[0.5px] border-stone dark:border-bdr-dk">
        <div>
          <div className="font-title text-[11px] tracking-[0.16em] uppercase text-ink-faint">{lang.name} · Text</div>
          <div style={{ fontFamily: lang.fontStack }} className="text-[20px] text-ink dark:text-ink-lt leading-tight">{text.title}</div>
        </div>
        <button onClick={onClose} className="text-ink-muted cursor-pointer" title="Close">
          <IoCloseOutline size={24} />
        </button>
      </div>

      {/* reading canvas */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28">
        <div className="max-w-[720px] mx-auto border-[0.5px] border-stone dark:border-bdr-dk rounded-[3px] p-[3px]">
          <div className="border-[0.5px] border-stone dark:border-bdr-dk rounded-[2px] bg-card-bg dark:bg-surf-dk px-4 py-5">
            <div style={{ fontFamily: lang.fontStack }} className={`text-[25px] text-ink dark:text-ink-lt ${under ? "leading-[2.7]" : "leading-[2.0]"}`}>
              {displayLines(text).map((group, gi) => (
                <div key={gi} className="mb-1.5">
                {group.map((li) => {
                const line = text.lines[li];
                const isRev = revealed.has(li);
                const endLbl = pages.get(`${li}:${line.length}`);
                return (
                  <span
                    key={li}
                    className={[
                      tappable ? "cursor-pointer rounded-[5px]" : "",
                      tappable && isRev ? "bg-accent/10" : "",
                    ].join(" ")}
                    onClick={tappable ? () => toggleLine(li) : undefined}
                  >
                    {line.map((s, ti) => {
                      const lbl = pages.get(`${li}:${ti}`);
                      return (
                        <span key={ti}>
                          {lbl && <FolioChip label={lbl} />}
                          {under ? (
                            <span className="inline-flex flex-col items-center align-bottom">
                              <span>{s.script}</span>
                              <span className="font-mono text-[9px] tracking-[0.02em] text-accent dark:text-accent-dk leading-[1.6] -mt-0.5">
                                {roman(s, lang, scheme)}
                              </span>
                            </span>
                          ) : (
                            s.script
                          )}
                        </span>
                      );
                    })}
                    {endLbl && <FolioChip label={endLbl} />}
                    <span className="text-accent dark:text-accent-dk px-[1px]">{lang.clauseMark}</span>
                    {tappable && isRev && (
                      <span className="font-mono text-[12px] tracking-[0.03em] text-accent dark:text-accent-dk px-1">
                        {line.map((s) => roman(s, lang, scheme)).join(" ")}
                        {" "}
                      </span>
                    )}{" "}
                  </span>
                );
                })}
                </div>
              ))}
            </div>
          </div>
          <div className="text-center font-mono text-[11px] text-ink-faint mt-3">
            {text.pageBreaks.length ? `${text.pageBreaks.length} folio sides · ` : ""}{displayLines(text).length} lines · {tokCount} tokens
          </div>
        </div>
      </div>

      {/* bottom reading bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 w-[min(720px,calc(100%-28px))] flex items-center gap-2 bg-card-bg dark:bg-surf-dk border-[0.5px] border-stone dark:border-bdr-dk rounded-[14px] px-2.5 py-2 shadow-[0_10px_26px_rgba(20,12,6,0.18)]">
        {lang.schemes.length > 1 && (
          <button
            onClick={cycleScheme}
            className="font-mono text-[11px] tracking-wider text-ink-muted border-[0.5px] border-dashed border-stone dark:border-bdr-dk rounded-[8px] px-2.5 py-2 cursor-pointer bg-transparent whitespace-nowrap"
            title="Romanization scheme"
          >
            {schemeLabel} ▾
          </button>
        )}
        <BarBtn on={sound} onClick={() => setSound((v) => !v)}>Aa&nbsp;Romanization</BarBtn>
        <BarBtn on={layout === "under"} disabled={!sound} onClick={() => sound && setLayout("under")}>Under</BarBtn>
        <BarBtn on={layout === "line"} disabled={!sound} onClick={() => sound && setLayout("line")}>By&nbsp;line</BarBtn>
      </div>
    </div>
  );
}
