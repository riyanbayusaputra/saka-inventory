"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const normalizeSn = (s: string) => s.replace(/\s+/g, "").toUpperCase();
export const splitSn = (text: string) => text.split(/[\n\r,;\t]+/).map(normalizeSn).filter(Boolean);

let audioCtx: AudioContext | null = null;

function beep(kind: "ok" | "error") {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx ??= new Ctx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = kind === "ok" ? 1200 : 300;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + (kind === "ok" ? 0.08 : 0.25));
    navigator.vibrate?.(kind === "ok" ? 40 : [80, 60, 80]);
  } catch {
    // bunyi tidak wajib
  }
}

function CameraScanner({ onCode }: { onCode: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cb = useRef(onCode);
  const [error, setError] = useState("");

  useEffect(() => {
    cb.current = onCode;
  });

  useEffect(() => {
    let cancelled = false;
    let controls: { stop: () => void } | undefined;
    const video = videoRef.current;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Kamera tidak tersedia. Buka aplikasi lewat alamat https (alamat Vercel), bukan http.");
        return;
      }
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93,
          BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints);
        const c = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video!,
          (result) => {
            if (result) cb.current(result.getText());
          }
        );
        if (cancelled) c.stop();
        else controls = c;
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? "Izin kamera ditolak. Aktifkan izin kamera untuk situs ini di pengaturan browser."
            : name === "NotFoundError"
            ? "Kamera tidak ditemukan di perangkat ini."
            : "Kamera tidak bisa dibuka. Tutup aplikasi lain yang memakai kamera, lalu coba lagi."
        );
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
      const stream = video?.srcObject as MediaStream | null | undefined;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) return <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>;

  return (
    <video
      ref={videoRef}
      playsInline
      muted
      className="aspect-video w-full rounded-md bg-black object-cover"
    />
  );
}

export function SerialInput({
  value, setList, check, suggestions = [], disabledReason,
}: {
  value: string[];
  setList: (fn: (prev: string[]) => string[]) => void;
  check?: (sn: string) => Promise<string | null>;
  suggestions?: string[];
  disabledReason?: string;
}) {
  const inputId = useId();
  const [text, setText] = useState("");
  const [camOpen, setCamOpen] = useState(false);
  const seen = useRef(new Set<string>());
  const last = useRef({ code: "", t: 0 });

  useEffect(() => {
    seen.current = new Set(value);
  }, [value]);

  function fail(msg: string) {
    beep("error");
    toast.error(msg);
  }

  function add(raw: string) {
    const sn = normalizeSn(raw);
    if (!sn) return;
    if (sn.length < 4 || sn.length > 64) return fail(`"${sn.slice(0, 30)}" tidak terlihat seperti nomor SN`);
    if (seen.current.has(sn)) return fail(`SN ${sn} sudah ada di daftar`);

    seen.current.add(sn);
    setList((prev) => (prev.includes(sn) ? prev : [...prev, sn]));
    beep("ok");

    if (check) {
      check(sn)
        .then((msg) => {
          if (!msg) return;
          seen.current.delete(sn);
          setList((prev) => prev.filter((x) => x !== sn));
          fail(`${sn}: ${msg}`);
        })
        .catch(() => {});
    }
  }

  function remove(sn: string) {
    seen.current.delete(sn);
    setList((prev) => prev.filter((x) => x !== sn));
  }

  function toggleSuggestion(sn: string) {
    if (value.includes(sn)) remove(sn);
    else {
      seen.current.add(sn);
      setList((prev) => (prev.includes(sn) ? prev : [...prev, sn]));
    }
  }

  function onCameraCode(codeText: string) {
    const sn = normalizeSn(codeText);
    const now = Date.now();
    // kamera membaca barcode yang sama berkali-kali; abaikan pembacaan ulang dalam 2,5 detik
    if (last.current.code === sn && now - last.current.t < 2500) return;
    last.current = { code: sn, t: now };
    add(sn);
  }

  function closeCamera() {
    setCamOpen(false);
    setTimeout(() => document.getElementById(inputId)?.focus(), 150);
  }

  function commitText() {
    if (!text.trim()) return;
    splitSn(text).forEach(add);
    setText("");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={text}
          autoComplete="off"
          disabled={!!disabledReason}
          placeholder={disabledReason ?? "Scan barcode atau ketik SN, lalu Enter"}
          className="font-mono"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || (e.key === "Tab" && text.trim())) {
              e.preventDefault();
              commitText();
            }
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (/[\n\r,;\t]/.test(pasted.trim())) {
              e.preventDefault();
              splitSn(pasted).forEach(add);
              setText("");
            }
          }}
        />
        <Button type="button" variant="outline" disabled={!!disabledReason} onClick={() => setCamOpen(true)}>
          <Camera className="mr-2 h-4 w-4" /> Kamera
        </Button>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{value.length} SN terisi</span>
        {value.length > 0 && (
          <button type="button" className="hover:underline" onClick={() => { seen.current.clear(); setList(() => []); }}>
            Hapus semua
          </button>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex max-h-32 flex-wrap gap-1 overflow-auto">
          {value.map((sn) => (
            <span key={sn} className="inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 font-mono text-xs">
              {sn}
              <button type="button" onClick={() => remove(sn)} aria-label={`Hapus ${sn}`}>
                <X className="h-3 w-3 text-muted-foreground hover:text-red-600" />
              </button>
            </span>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">SN tersedia di site asal (klik untuk memilih):</p>
          <div className="flex max-h-24 flex-wrap gap-1 overflow-auto">
            {suggestions.slice(0, 80).map((sn) => (
              <button
                key={sn} type="button" onClick={() => toggleSuggestion(sn)}
                className={`rounded border px-2 py-0.5 font-mono text-xs ${
                  value.includes(sn) ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {sn}
              </button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={camOpen} onOpenChange={(o) => (o ? setCamOpen(true) : closeCamera())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan barcode SN</DialogTitle>
          </DialogHeader>
          {camOpen && <CameraScanner onCode={onCameraCode} />}
          <p className="text-sm text-muted-foreground">
            Arahkan kamera ke barcode SN pada stiker, jarak sekitar 10–20 cm dengan cahaya cukup. SN masuk otomatis dan
            kamera tetap menyala untuk scan berikutnya. Terscan: <b>{value.length}</b> SN.
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={closeCamera}>Selesai</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}