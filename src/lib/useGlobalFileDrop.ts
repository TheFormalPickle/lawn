import { useEffect, useRef, useState } from "react";

export function isVideoFile(file: File) {
  return (
    file.type.startsWith("video/") ||
    /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(file.name)
  );
}
export function hasFileDrop(transfer: DataTransfer | null) {
  return Array.from(transfer?.types ?? []).includes("Files");
}

/** Local targets own their routing; capture cleanup still runs for handled drops. */
export function useGlobalFileDrop(onFiles: (files: File[]) => void) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  useEffect(() => {
    const localTarget = (event: DragEvent) =>
      event.target instanceof Element &&
      Boolean(event.target.closest("[data-file-drop]"));
    const enter = (event: DragEvent) => {
      if (!hasFileDrop(event.dataTransfer)) return;
      event.preventDefault();
      depth.current++;
      setActive(!localTarget(event));
    };
    const over = (event: DragEvent) => {
      if (!hasFileDrop(event.dataTransfer)) return;
      event.preventDefault();
      setActive(!localTarget(event));
    };
    const leave = (event: DragEvent) => {
      if (!hasFileDrop(event.dataTransfer)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setActive(false);
    };
    const clear = () => {
      depth.current = 0;
      setActive(false);
    };
    const drop = (event: DragEvent) => {
      if (!hasFileDrop(event.dataTransfer) || event.defaultPrevented) return;
      event.preventDefault();
      const files = Array.from(event.dataTransfer?.files ?? []).filter(
        isVideoFile,
      );
      if (files.length) onFiles(files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", clear, true);
    window.addEventListener("drop", drop);
    window.addEventListener("dragend", clear);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", clear, true);
      window.removeEventListener("drop", drop);
      window.removeEventListener("dragend", clear);
    };
  }, [onFiles]);
  return active;
}
