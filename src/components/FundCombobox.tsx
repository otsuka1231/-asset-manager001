import { useState } from "react";
import { FUND_OPTIONS } from "../types";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

/** Text field with a live-filtered dropdown of official fund names.
 *  Typing a casual term (オルカン / SP500 / VTI) narrows the list, but any
 *  custom name (e.g. an individual stock) can still be entered freely. */
export default function FundCombobox({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const q = value.trim().toLowerCase();
  const matches = FUND_OPTIONS.filter((f) =>
    !q || (f.name + " " + f.keywords).toLowerCase().includes(q)
  ).slice(0, 8);

  return (
    <div className="combo">
      <input
        type="text"
        placeholder="銘柄を検索（例: オルカン, SP500）"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {open && matches.length > 0 && (
        <ul className="combo-list">
          {matches.map((f) => (
            <li
              key={f.name}
              // onMouseDown fires before the input's onBlur, so the pick registers
              onMouseDown={(e) => { e.preventDefault(); onChange(f.name); setOpen(false); }}
            >
              {f.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
