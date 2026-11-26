/* Generated from the owner-approved all-themes mockup (docs/mockups/all-themes-pip.html). Original art. */
import type { ReactNode } from 'react';
import type { OutfitItem, OutfitProp } from './outfits';

/** Items worn on the head, drawn in head space (the original 120 × 120 head). */
export const HEAD_ITEMS: Partial<Record<OutfitItem, ReactNode>> = {
  'blue-pen': (
    <g data-item="blue-pen">
      <g>
        <path d="M106 58 L80 22" stroke="#3b6fd8" strokeWidth="7" />
        <path d="M80 22 L76 16" stroke="#cfd8f0" strokeWidth="7" />
        <circle cx="105" cy="57" r="3" fill="#1d3f8a" />
      </g>
    </g>
  ),
  'round-glasses': (
    <g data-item="round-glasses">
      <g fill="rgb(255 255 255 / 25%)" stroke="#2b2a3a" strokeWidth="3">
        <circle cx="45" cy="58" r="11" />
        <circle cx="75" cy="58" r="11" />
        <path d="M56 58 Q60 54 64 58" fill="none" />
      </g>
    </g>
  ),
  'dark-glasses': (
    <g data-item="dark-glasses">
      <g stroke="#2b2a3a" strokeWidth="3">
        <rect x="32" y="50" width="24" height="16" rx="6" fill="#2b2a3a" />
        <rect x="64" y="50" width="24" height="16" rx="6" fill="#2b2a3a" />
        <path d="M56 57h8" />
      </g>
    </g>
  ),
  'safety-specs': (
    <g data-item="safety-specs">
      <g stroke="#2b2a3a" strokeWidth="2.5">
        <path d="M30 52h60v8c0 6-6 10-12 10H42c-6 0-12-4-12-10z" fill="rgb(140 220 255 / 45%)" />
      </g>
    </g>
  ),
  goggles: (
    <g data-item="goggles">
      <g stroke="#2b2a3a" strokeWidth="2.5">
        <path d="M18 42 H102" stroke="#4f5b77" strokeWidth="6" />
        <circle cx="45" cy="40" r="10" fill="#bfe6ff" />
        <circle cx="75" cy="40" r="10" fill="#bfe6ff" />
      </g>
    </g>
  ),
  leaf: (
    <g data-item="leaf">
      <g>
        <path
          d="M60 34 C 50 22 54 8 68 5 C 73 18 70 28 60 34 Z"
          fill="#43c46b"
          stroke="#2b2a3a"
          strokeWidth="2"
        />
        <path d="M60 34 L66 14" stroke="#2b2a3a" strokeWidth="1.6" />
      </g>
    </g>
  ),
  'explorer-hat': (
    <g data-item="explorer-hat">
      <g stroke="#2b2a3a" strokeWidth="2.4">
        <path d="M36 30 Q60 0 84 30 Z" fill="#c9a86a" />
        <ellipse cx="60" cy="30" rx="36" ry="7" fill="#b8955a" />
        <path d="M37 26 H83" stroke="#7a5a2e" strokeWidth="4" />
      </g>
    </g>
  ),
  beret: (
    <g data-item="beret">
      <g stroke="#2b2a3a" strokeWidth="2">
        <ellipse cx="66" cy="24" rx="26" ry="9" fill="#b8323a" transform="rotate(-12 66 24)" />
        <circle cx="68" cy="13" r="3.5" fill="#b8323a" />
      </g>
    </g>
  ),
  'alpine-hat': (
    <g data-item="alpine-hat">
      <g stroke="#2b2a3a" strokeWidth="2.2">
        <path d="M38 30 L48 10 H74 L82 30 Z" fill="#3f7a4a" />
        <ellipse cx="60" cy="30" rx="32" ry="6" fill="#356a3f" />
        <path d="M76 14 C 86 4 92 6 94 2" stroke="#d9473f" strokeWidth="3" fill="none" />
      </g>
    </g>
  ),
  visor: (
    <g data-item="visor">
      <g stroke="#2b2a3a" strokeWidth="2.2">
        <path d="M30 34 Q60 22 90 34 L90 40 Q60 30 30 40 Z" fill="#2fae8f" />
        <path d="M60 30 Q86 34 104 44 Q80 44 62 38 Z" fill="#26957a" />
      </g>
    </g>
  ),
  headset: (
    <g data-item="headset">
      <g stroke="#2b2a3a" strokeWidth="2.6">
        <path d="M22 60 Q22 14 60 14 Q98 14 98 60" fill="none" stroke="#4f5b77" strokeWidth="6" />
        <rect x="14" y="54" width="14" height="20" rx="5" fill="#4f5b77" />
        <rect x="92" y="54" width="14" height="20" rx="5" fill="#4f5b77" />
        <path d="M21 74 Q28 94 46 96" fill="none" />
        <circle cx="47" cy="96" r="3.5" fill="#2b2a3a" />
      </g>
    </g>
  ),
};

/** Items worn at the shoulders, drawn in frame space. */
export const BODY_ITEMS: Partial<Record<OutfitItem, ReactNode>> = {
  'lab-collar': (
    <g data-item="lab-collar">
      <g fill="#fff" stroke="#2b2a3a" strokeWidth="1.8">
        <polygon points="38,100 58,100 48,120" />
        <polygon points="62,100 82,100 72,120" />
      </g>
    </g>
  ),
  'bow-tie': (
    <g data-item="bow-tie">
      <g fill="#6c47f5" stroke="#2b2a3a" strokeWidth="1.6">
        <polygon points="60,101 46,94 46,108" />
        <polygon points="60,101 74,94 74,108" />
        <circle cx="60" cy="101" r="3" />
      </g>
    </g>
  ),
  neckerchief: (
    <g data-item="neckerchief">
      <g stroke="#2b2a3a" strokeWidth="1.8">
        <path d="M38 98 Q60 108 82 98 L66 118 Q60 122 54 118 Z" fill="#e0453a" />
      </g>
    </g>
  ),
};

/** Props, drawn about (20, 108); the figure moves them to the front of the ring. */
export const PROPS: Record<OutfitProp, ReactNode> = {
  calculator: (
    <g stroke="#2b2a3a" strokeWidth="1.8">
      <rect x="8" y="94" width="24" height="28" rx="4" fill="#4f5b77" />
      <rect x="11.5" y="97.5" width="17" height="7" rx="1.5" fill="#cfeedd" />
      <g fill="#ffd34d" strokeWidth="1.2">
        <circle cx="14" cy="110" r="2.2" />
        <circle cx="20" cy="110" r="2.2" />
        <circle cx="26" cy="110" r="2.2" />
        <circle cx="14" cy="116.5" r="2.2" />
        <circle cx="20" cy="116.5" r="2.2" />
      </g>
      <rect x="23.8" y="114.3" width="4.4" height="4.4" rx="1" fill="#ff8fb1" strokeWidth="1.2" />
    </g>
  ),
  compass: (
    <g stroke="#2b2a3a" strokeWidth="2.2" strokeLinecap="round">
      <path d="M20 96 L10 120 M20 96 L30 120" />
      <circle cx="20" cy="95" r="3" fill="#ffc83d" />
    </g>
  ),
  chart: (
    <g stroke="#2b2a3a" strokeWidth="1.6">
      <rect x="6" y="110" width="7" height="10" fill="#2fae8f" />
      <rect x="15" y="102" width="7" height="18" fill="#ffc83d" />
      <rect x="24" y="106" width="7" height="14" fill="#ff8fb1" />
    </g>
  ),
  'speech-bubble': (
    <g stroke="#2b2a3a" strokeWidth="1.8">
      <path
        d="M6 100 h24 a4 4 0 0 1 4 4 v8 a4 4 0 0 1 -4 4 h-14 l-6 5 v-5 h-4 a4 4 0 0 1 -4 -4 v-8 a4 4 0 0 1 4 -4z"
        fill="#fff"
      />
      <path d="M11 106h18M11 111h12" />
    </g>
  ),
  book: (
    <g stroke="#2b2a3a" strokeWidth="1.8" strokeLinejoin="round">
      <path
        d="M3 101 Q11 96 20 101 Q29 96 37 101 V123 Q29 118 20 123 Q11 118 3 123 Z"
        fill="#7b3fe4"
      />
      <path d="M5 99 Q12 94.5 20 99.5 V120 Q12 115.5 5 119 Z" fill="#fffaf0" />
      <path d="M35 99 Q28 94.5 20 99.5 V120 Q28 115.5 35 119 Z" fill="#fffaf0" />
      <path
        d="M8.5 104 Q13 102 17 104 M8.5 108.5 Q13 106.5 17 108.5 M23 104 Q27 102 31.5 104 M23 108.5 Q27 106.5 31.5 108.5"
        fill="none"
        strokeWidth="1.2"
      />
      <path d="M27 99 V108 l2.2 -2 2.2 2 V98" fill="#e0453a" strokeWidth="1.2" />
    </g>
  ),
  magnifier: (
    <g stroke="#2b2a3a" strokeWidth="1.8">
      <circle cx="16" cy="106" r="8" fill="#dff1ff" />
      <path d="M22 112 L30 121" strokeWidth="4" strokeLinecap="round" />
    </g>
  ),
  'test-tube': (
    <g stroke="#2b2a3a" strokeWidth="1.8" transform="rotate(-20 18 110)">
      <path d="M13 94 V118 A5 5 0 0 0 23 118 V94 Z" fill="#fff" />
      <path d="M13 108 H23 V118 A5 5 0 0 1 13 118 Z" fill="#43c46b" />
    </g>
  ),
  magnet: (
    <g stroke="#2b2a3a" strokeWidth="1.8">
      <path
        d="M8 100 V112 A10 10 0 0 0 28 112 V100 H22 V112 A4 4 0 0 1 14 112 V100 Z"
        fill="#e0453a"
      />
      <rect x="8" y="97" width="6" height="5" fill="#d9d9e3" />
      <rect x="22" y="97" width="6" height="5" fill="#d9d9e3" />
    </g>
  ),
  flask: (
    <g stroke="#2b2a3a" strokeWidth="1.8">
      <path d="M14 96 H22 V104 L30 120 H6 L14 104 Z" fill="#fff" />
      <path d="M9 114 H27 L30 120 H6 Z" fill="#b79cff" />
    </g>
  ),
  laptop: (
    <g stroke="#2b2a3a" strokeWidth="1.8">
      <rect x="9" y="100" width="22" height="14" rx="2" fill="#4f5b77" />
      <rect x="5" y="114" width="30" height="4" rx="1.5" fill="#9aa3b8" />
      <circle cx="20" cy="107" r="3" fill="#ff8fb1" stroke="none" />
    </g>
  ),
  scroll: (
    <g stroke="#2b2a3a" strokeWidth="1.8">
      <rect x="8" y="102" width="22" height="16" fill="#f6e3b4" />
      <circle cx="8" cy="110" r="3.5" fill="#e7cd8e" />
      <circle cx="30" cy="110" r="3.5" fill="#e7cd8e" />
    </g>
  ),
  croissant: (
    <g stroke="#2b2a3a" strokeWidth="1.8">
      <path d="M5 116 Q19 94 33 116 Q26 109 19 109 Q12 109 5 116 Z" fill="#e8a74a" />
    </g>
  ),
  pretzel: (
    <g fill="none" stroke="#b5702f" strokeWidth="4" strokeLinecap="round">
      <path d="M10 118 C 2 104 18 96 19 110 C 20 96 36 104 28 118 C 24 112 14 112 10 118 Z" />
    </g>
  ),
  guitar: (
    <g stroke="#2b2a3a" strokeWidth="1.6">
      <circle cx="14" cy="114" r="7" fill="#e8a74a" />
      <circle cx="20" cy="107" r="5" fill="#e8a74a" />
      <path d="M22 105 L34 92" strokeWidth="3" />
      <circle cx="14" cy="114" r="2" fill="#2b2a3a" />
    </g>
  ),
  mask: (
    <g stroke="#2b2a3a" strokeWidth="1.8">
      <path d="M6 100 Q19 95 32 100 Q32 118 19 121 Q6 118 6 100 Z" fill="#ffe45c" />
      <circle cx="13" cy="106" r="2" fill="#2b2a3a" />
      <circle cx="25" cy="106" r="2" fill="#2b2a3a" />
      <path d="M12 112 Q19 118 26 112" fill="none" />
    </g>
  ),
  clapperboard: (
    <g stroke="#2b2a3a" strokeWidth="1.8">
      <rect x="6" y="104" width="26" height="16" fill="#2b2a3a" />
      <path d="M6 97 L32 97 L32 104 L6 104 Z" fill="#fff" />
      <path d="M11 97 L9 104 M18 97 L16 104 M25 97 L23 104" strokeWidth="2.4" />
    </g>
  ),
};

/** The six looks: head art (head space) and, for the beanie look, the bandana used under a hat. */
export const LOOK_ART: Record<string, ReactNode> = {
  a0: (
    <g data-look-part="tuft">
      <g fill="#E35F17" stroke="#3A2622" strokeWidth="1.4">
        <path d="M52 38 L56 26 L60 36 L64 24 L68 38 Z" />
      </g>
    </g>
  ),
  a1: (
    <g data-look-part="moustache">
      <path
        d="M60 99 C 55 95 48 96 46 101 C 51 100 56 101 60 101 C 64 101 69 100 74 101 C 72 96 65 95 60 99 Z"
        fill="#3A2622"
      />
    </g>
  ),
  b0: (
    <g data-look-part="bow">
      <g fill="#ff7ab6" stroke="#2b2a3a" strokeWidth="1.6">
        <polygon points="88,26 78,18 78,34" />
        <polygon points="88,26 98,18 98,34" />
        <circle cx="88" cy="26" r="3" />
      </g>
      <g stroke="#3A2622" strokeWidth="2" strokeLinecap="round">
        <path d="M38 55 l-4 -4 M41 52 l-2 -5 M82 55 l4 -4 M79 52 l2 -5" />
      </g>
    </g>
  ),
  b1: (
    <g data-look-part="clip">
      <g stroke="#2b2a3a" strokeWidth="1.4">
        <rect
          x="30"
          y="34"
          width="16"
          height="6"
          rx="3"
          fill="#7fd1c7"
          transform="rotate(-25 38 37)"
        />
        <circle cx="34" cy="38" r="3" fill="#ffd34d" />
      </g>
      <g fill="#ff9aa8" opacity=".55">
        <ellipse cx="36" cy="74" rx="7" ry="4" />
        <ellipse cx="84" cy="74" rx="7" ry="4" />
      </g>
    </g>
  ),
  c0: (
    <g data-look-part="stud">
      <circle cx="99" cy="50" r="3.2" fill="#d7dbe6" stroke="#2b2a3a" strokeWidth="1.2" />
      <g fill="#a0522d">
        <circle cx="40" cy="74" r="2" />
        <circle cx="45" cy="78" r="2" />
        <circle cx="37" cy="79" r="2" />
        <circle cx="80" cy="74" r="2" />
        <circle cx="75" cy="78" r="2" />
        <circle cx="83" cy="79" r="2" />
      </g>
    </g>
  ),
  c1: (
    <g data-look-part="beanie">
      <g stroke="#2b2a3a" strokeWidth="2">
        <path d="M30 36 Q60 4 90 36 Z" fill="#6a7fd1" />
        <rect x="28" y="32" width="64" height="9" rx="4" fill="#5468b8" />
        <circle cx="60" cy="10" r="5" fill="#ffd34d" />
      </g>
    </g>
  ),
};
export const BANDANA: ReactNode = (
  <g data-look-part="bandana">
    <g stroke="#2b2a3a" strokeWidth="1.8">
      <path d="M38 98 Q60 108 82 98 L66 116 Q60 120 54 116 Z" fill="#6a7fd1" />
    </g>
  </g>
);
