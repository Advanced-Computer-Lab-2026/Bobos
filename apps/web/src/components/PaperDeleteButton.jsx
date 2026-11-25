import { useEffect, useRef } from "react";

export default function PaperDeleteButton({ label, disabled, onDelete }) {
  const element = useRef(null);
  const callback = useRef(onDelete);
  callback.current = onDelete;
  useEffect(() => {
    let active = true;
    customElements.whenDefined("portal-paper-delete").then(() => {
      if (active && element.current) element.current.perform = () => callback.current();
    });
    return () => { active = false; };
  }, []);
  return <portal-paper-delete ref={element} label={label} disabled={disabled ? "" : undefined} />;
}
