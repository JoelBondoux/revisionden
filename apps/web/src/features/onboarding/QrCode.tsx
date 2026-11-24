import qrcode from 'qrcode-generator';

const QUIET = 4;

/** A QR code drawn as one SVG path (black squares on white, with the standard quiet border). */
export function QrCode({
  value,
  label,
  size = 220,
}: {
  value: string;
  label: string;
  size?: number;
}) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  let d = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) d += `M${col + QUIET} ${row + QUIET}h1v1h-1z`;
    }
  }
  const box = count + QUIET * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${box} ${box}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="qr-code"
    >
      <rect width={box} height={box} fill="#FFFFFF" />
      <path d={d} fill="#000000" />
    </svg>
  );
}
