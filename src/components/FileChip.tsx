import {
  File,
  FileArchive,
  FileCode,
  FileJson,
  FileSpreadsheet,
  FileText,
  Presentation,
  type LucideIcon,
} from "lucide-react";

// Chip file in stile Claude: icona pulita colorata per tipo + nome + estensione.
// Dark, compatto, simmetrico — niente card bianca sproporzionata.

interface Meta {
  Icon: LucideIcon;
  color: string; // colore dell'icona
  label: string; // etichetta tipo
}

function metaOf(name: string): Meta {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const M = (Icon: LucideIcon, color: string, label: string): Meta => ({ Icon, color, label });
  switch (ext) {
    case "pdf":
      return M(FileText, "#e5484d", "PDF");
    case "doc":
    case "docx":
      return M(FileText, "#4c7df0", "DOC");
    case "md":
    case "markdown":
    case "mdx":
      return M(FileText, "#9aa0a6", "MD");
    case "txt":
    case "log":
      return M(FileText, "#9aa0a6", "TXT");
    case "csv":
      return M(FileSpreadsheet, "#16a37b", "CSV");
    case "xls":
    case "xlsx":
      return M(FileSpreadsheet, "#16a37b", "XLS");
    case "ppt":
    case "pptx":
      return M(Presentation, "#e8833a", "PPT");
    case "zip":
    case "rar":
    case "tar":
    case "gz":
      return M(FileArchive, "#a855f7", ext.toUpperCase());
    case "json":
      return M(FileJson, "#e0a93a", "JSON");
    case "css":
    case "scss":
      return M(FileCode, "#4c7df0", "CSS");
    case "html":
    case "htm":
      return M(FileCode, "#e8833a", "HTML");
    case "js":
    case "mjs":
      return M(FileCode, "#e0a93a", "JS");
    case "jsx":
      return M(FileCode, "#4c7df0", "JSX");
    case "ts":
    case "tsx":
      return M(FileCode, "#4c7df0", ext.toUpperCase());
    case "py":
    case "rb":
    case "go":
    case "rs":
    case "java":
    case "c":
    case "cpp":
    case "sh":
    case "sql":
      return M(FileCode, "#e8833a", ext.toUpperCase());
    default:
      return M(File, "#9aa0a6", ext ? ext.toUpperCase() : "FILE");
  }
}

export default function FileChip({ name, onRemove }: { name: string; onRemove?: () => void }) {
  const { Icon, color, label } = metaOf(name);
  return (
    <div className="relative flex items-center gap-2.5 rounded-xl border border-[var(--color-line2)] bg-[rgba(242,239,233,0.05)] py-2 pl-2 pr-9">
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
        style={{ background: `${color}22`, color }}
      >
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <div className="max-w-[150px] truncate text-[0.74rem] leading-tight text-paper">{name}</div>
        <div className="mono mt-0.5 text-[0.5rem] uppercase tracking-wide text-faint">{label}</div>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          title="Rimuovi"
          className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full text-faint transition hover:bg-[rgba(0,0,0,0.3)] hover:text-paper"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
