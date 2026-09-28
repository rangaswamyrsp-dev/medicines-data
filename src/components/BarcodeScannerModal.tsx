import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, Flashlight, RefreshCw, X, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

export function BarcodeScannerModal({ open, onClose, onDetected }: BarcodeScannerModalProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = "html5-barcode-scanner-view";

  // Stop scanner when modal closes
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn("Scanner stop warning:", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const startScanner = async (cameraId?: string) => {
    setErrorMsg(null);
    try {
      // Clean up any existing scanner instance first
      await stopScanner();

      // Ensure reader container exists
      const container = document.getElementById(readerElementId);
      if (!container) return;

      const html5QrCode = new Html5Qrcode(readerElementId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
      });

      scannerRef.current = html5QrCode;

      // Camera config: prioritize back/environment camera for retail packaging
      const cameraConfig = cameraId
        ? { deviceId: { exact: cameraId } }
        : { facingMode: "environment" };

      await html5QrCode.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            // Rectangular scanning area optimal for 1D barcodes
            const width = Math.floor(viewfinderWidth * 0.85);
            const height = Math.floor(viewfinderHeight * 0.45);
            return { width: Math.max(width, 240), height: Math.max(height, 120) };
          },
          aspectRatio: 1.3333,
        },
        (decodedText) => {
          // Barcode detected!
          const clean = decodedText.trim();
          if (clean) {
            // Play quick subtle beep / feedback if supported
            try {
              if (typeof window !== "undefined" && "vibrate" in navigator) {
                navigator.vibrate?.(60);
              }
            } catch {}

            // Stop scanner immediately
            stopScanner().then(() => {
              onDetected(clean);
              onClose();
            });
          }
        },
        () => {
          // Scanning frame error (expected during searching, suppress)
        }
      );

      setIsScanning(true);

      // Check if torch/flash is supported
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if ((capabilities as any)?.torch) {
          setHasTorch(true);
        }
      } catch {}
    } catch (err: any) {
      console.error("Camera scanner start error:", err);
      setIsScanning(false);
      const msg = err?.name === "NotAllowedError" || err?.message?.includes("Permission")
        ? "Camera permission denied. Please allow camera access in your browser or enter the barcode manually."
        : "Unable to start camera. Please ensure camera is connected or enter the barcode manually.";
      setErrorMsg(msg);
    }
  };

  useEffect(() => {
    if (!open) {
      stopScanner();
      return;
    }

    // Discover available video inputs
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer environment / back camera
          const backCam = devices.find((d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment")
          );
          const firstDevice = devices[0];
          const chosen = backCam ? backCam.id : (firstDevice ? firstDevice.id : "");
          setSelectedCameraId(chosen);
          startScanner(chosen);
        } else {
          startScanner();
        }
      })
      .catch(() => {
        // Fallback to default constraints
        startScanner();
      });

    return () => {
      stopScanner();
    };
  }, [open]);

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const next = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: next } as any],
      });
      setTorchOn(next);
    } catch (err) {
      console.warn("Torch toggle failed:", err);
    }
  };

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextDevice = cameras[nextIndex];
    if (nextDevice) {
      setSelectedCameraId(nextDevice.id);
      startScanner(nextDevice.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-background">
        <DialogHeader className="p-4 pb-2 border-b flex flex-row items-center justify-between">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <span>Scan Medicine Barcode</span>
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="relative bg-black flex flex-col items-center justify-center min-h-[300px] max-h-[460px] overflow-hidden">
          {/* Scanner Viewport Container */}
          <div id={readerElementId} className="w-full h-full" />

          {/* Scanner Target Guide Overlay */}
          {isScanning && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative w-[85%] max-w-[320px] h-[130px] rounded-xl border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                {/* Animated laser line */}
                <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse transition-all" />
                <div className="absolute -top-7 inset-x-0 text-center text-[11px] font-semibold tracking-wide text-white drop-shadow">
                  Align 1D Barcode (EAN / UPC / GTIN) inside box
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="absolute inset-0 bg-background/95 p-6 flex flex-col items-center justify-center text-center gap-3">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-foreground font-medium">{errorMsg}</p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => startScanner(selectedCameraId)}>
                  Try Again
                </Button>
                <Button size="sm" onClick={onClose}>
                  Enter Manually
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="p-3 bg-muted/30 border-t flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            {cameras.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={switchCamera}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Switch Camera
              </Button>
            )}
            {hasTorch && (
              <Button
                variant={torchOn ? "default" : "outline"}
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={toggleTorch}
              >
                <Flashlight className="h-3.5 w-3.5" /> {torchOn ? "Torch On" : "Torch"}
              </Button>
            )}
          </div>

          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
