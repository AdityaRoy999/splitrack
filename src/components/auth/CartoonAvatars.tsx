import React from 'react';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

export interface CartoonAvatarItem {
  id: string;
  name: string;
  bgGradient: [string, string];
  render: (size: number) => React.ReactNode;
}

export const CARTOON_AVATARS: CartoonAvatarItem[] = [
  {
    id: 'cyber_boy',
    name: 'Cosmo Kid',
    bgGradient: ['#3B82F6', '#1E1B4B'],
    render: (size: number) => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="cb_bg" cx="40%" cy="30%" r="70%">
            <Stop offset="0%" stopColor="#60A5FA" />
            <Stop offset="100%" stopColor="#1E3A8A" />
          </RadialGradient>
          <RadialGradient id="cb_skin" cx="45%" cy="35%" r="60%">
            <Stop offset="0%" stopColor="#FED7AA" />
            <Stop offset="70%" stopColor="#FDBA74" />
            <Stop offset="100%" stopColor="#EA580C" />
          </RadialGradient>
          <LinearGradient id="cb_hair" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#818CF8" />
            <Stop offset="100%" stopColor="#312E81" />
          </LinearGradient>
          <LinearGradient id="cb_hoodie" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#06B6D4" />
            <Stop offset="100%" stopColor="#083344" />
          </LinearGradient>
        </Defs>
        {/* Background Sphere */}
        <Circle cx="50" cy="50" r="48" fill="url(#cb_bg)" />
        {/* Hoodie Shoulders */}
        <Path d="M22 84 Q50 68 78 84 L80 100 L20 100 Z" fill="url(#cb_hoodie)" />
        {/* Head Sphere */}
        <Circle cx="50" cy="48" r="26" fill="url(#cb_skin)" />
        {/* 3D Hair Tufts */}
        <Path d="M28 42 C24 24 38 18 50 18 C64 18 76 25 72 42 C68 34 60 26 50 26 C40 26 32 34 28 42 Z" fill="url(#cb_hair)" />
        {/* Futuristic Glasses */}
        <Rect x="30" y="42" width="16" height="12" rx="4" fill="#0F172A" />
        <Rect x="54" y="42" width="16" height="12" rx="4" fill="#0F172A" />
        <Rect x="46" y="46" width="8" height="3" fill="#64748B" />
        {/* Glasses Lens Glow */}
        <Rect x="32" y="44" width="12" height="8" rx="2" fill="#38BDF8" opacity="0.85" />
        <Rect x="56" y="44" width="12" height="8" rx="2" fill="#38BDF8" opacity="0.85" />
        <Path d="M34 45 L42 45" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
        <Path d="M58 45 L66 45" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
        {/* Smile */}
        <Path d="M44 63 Q50 67 56 63" stroke="#9A3412" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </Svg>
    ),
  },
  {
    id: 'neon_maya',
    name: 'Neon Maya',
    bgGradient: ['#EC4899', '#4C1D95'],
    render: (size: number) => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="nm_bg" cx="40%" cy="30%" r="70%">
            <Stop offset="0%" stopColor="#F472B6" />
            <Stop offset="100%" stopColor="#581C87" />
          </RadialGradient>
          <RadialGradient id="nm_skin" cx="45%" cy="35%" r="60%">
            <Stop offset="0%" stopColor="#FFE4E6" />
            <Stop offset="70%" stopColor="#FECDD3" />
            <Stop offset="100%" stopColor="#FB7185" />
          </RadialGradient>
          <LinearGradient id="nm_hair" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#A855F7" />
            <Stop offset="100%" stopColor="#3B0764" />
          </LinearGradient>
        </Defs>
        <Circle cx="50" cy="50" r="48" fill="url(#nm_bg)" />
        {/* Hair Back */}
        <Circle cx="50" cy="48" r="32" fill="url(#nm_hair)" />
        {/* Body */}
        <Path d="M26 84 Q50 70 74 84 L76 100 L24 100 Z" fill="#7C3AED" />
        {/* Face */}
        <Circle cx="50" cy="50" r="24" fill="url(#nm_skin)" />
        {/* Bangs */}
        <Path d="M30 42 Q50 28 70 42 C64 34 56 32 50 32 C44 32 36 34 30 42 Z" fill="#6B21A8" />
        {/* Eyes with 3D twinkle */}
        <Circle cx="41" cy="50" r="4" fill="#1E1B4B" />
        <Circle cx="59" cy="50" r="4" fill="#1E1B4B" />
        <Circle cx="40" cy="48.5" r="1.5" fill="#FFFFFF" />
        <Circle cx="58" cy="48.5" r="1.5" fill="#FFFFFF" />
        {/* Rosy Cheeks */}
        <Circle cx="35" cy="56" r="3.5" fill="#F43F5E" opacity="0.4" />
        <Circle cx="65" cy="56" r="3.5" fill="#F43F5E" opacity="0.4" />
        {/* Smile */}
        <Path d="M45 61 Q50 65 55 61" stroke="#E11D48" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        {/* Glowing Neon Headphones */}
        <Path d="M20 50 C20 28 80 28 80 50" stroke="#06B6D4" strokeWidth="5" strokeLinecap="round" fill="none" />
        <Rect x="16" y="44" width="8" height="15" rx="4" fill="#22D3EE" />
        <Rect x="76" y="44" width="8" height="15" rx="4" fill="#22D3EE" />
      </Svg>
    ),
  },
  {
    id: 'cool_cat',
    name: 'Cool Cat',
    bgGradient: ['#F59E0B', '#78350F'],
    render: (size: number) => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="cc_bg" cx="40%" cy="30%" r="70%">
            <Stop offset="0%" stopColor="#FCD34D" />
            <Stop offset="100%" stopColor="#92400E" />
          </RadialGradient>
          <RadialGradient id="cc_fur" cx="45%" cy="35%" r="60%">
            <Stop offset="0%" stopColor="#F3F4F6" />
            <Stop offset="70%" stopColor="#E5E7EB" />
            <Stop offset="100%" stopColor="#9CA3AF" />
          </RadialGradient>
          <LinearGradient id="cc_shades" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#F43F5E" />
            <Stop offset="100%" stopColor="#881337" />
          </LinearGradient>
        </Defs>
        <Circle cx="50" cy="50" r="48" fill="url(#cc_bg)" />
        {/* Cat Ears */}
        <Path d="M26 36 L34 16 L50 30 Z" fill="#9CA3AF" />
        <Path d="M29 34 L35 22 L46 30 Z" fill="#FDA4AF" />
        <Path d="M74 36 L66 16 L50 30 Z" fill="#9CA3AF" />
        <Path d="M71 34 L65 22 L54 30 Z" fill="#FDA4AF" />
        {/* Body */}
        <Path d="M28 82 Q50 68 72 82 L76 100 L24 100 Z" fill="#18181B" />
        {/* Golden Chain */}
        <Path d="M38 84 Q50 94 62 84" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round" fill="none" />
        {/* Cat Head */}
        <Circle cx="50" cy="52" r="28" fill="url(#cc_fur)" />
        {/* 3D Pixel / Sunset Sunglasses */}
        <Rect x="26" y="44" width="22" height="14" rx="3" fill="url(#cc_shades)" />
        <Rect x="52" y="44" width="22" height="14" rx="3" fill="url(#cc_shades)" />
        <Rect x="47" y="48" width="6" height="3" fill="#111827" />
        <Path d="M28 47 L44 47" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
        <Path d="M54 47 L70 47" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
        {/* Pink Nose */}
        <Path d="M47 64 L53 64 L50 68 Z" fill="#FB7185" />
        {/* Cute Whiskers */}
        <Path d="M22 62 L38 64 M22 68 L38 67" stroke="#4B5563" strokeWidth="1.5" strokeLinecap="round" />
        <Path d="M78 62 L62 64 M78 68 L62 67" stroke="#4B5563" strokeWidth="1.5" strokeLinecap="round" />
        {/* Cat Smirk */}
        <Path d="M46 69 Q50 73 54 69" stroke="#374151" strokeWidth="2" strokeLinecap="round" fill="none" />
      </Svg>
    ),
  },
  {
    id: 'astro_panda',
    name: 'Astro Panda',
    bgGradient: ['#10B981', '#064E3B'],
    render: (size: number) => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="ap_bg" cx="40%" cy="30%" r="70%">
            <Stop offset="0%" stopColor="#34D399" />
            <Stop offset="100%" stopColor="#064E3B" />
          </RadialGradient>
          <RadialGradient id="ap_visor" cx="40%" cy="30%" r="70%">
            <Stop offset="0%" stopColor="#38BDF8" />
            <Stop offset="60%" stopColor="#0284C7" />
            <Stop offset="100%" stopColor="#0C4A6E" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="48" fill="url(#ap_bg)" />
        {/* Panda Ears */}
        <Circle cx="28" cy="24" r="10" fill="#111827" />
        <Circle cx="72" cy="24" r="10" fill="#111827" />
        {/* Space Suit Shoulders */}
        <Path d="M22 84 Q50 72 78 84 L80 100 L20 100 Z" fill="#F8FAFC" />
        <Rect x="42" y="86" width="16" height="8" rx="2" fill="#10B981" />
        {/* Glossy Astronaut Helmet */}
        <Circle cx="50" cy="50" r="32" fill="#FFFFFF" />
        <Circle cx="50" cy="50" r="31" fill="#E2E8F0" />
        {/* Tinted Visor */}
        <Rect x="26" y="34" width="48" height="32" rx="16" fill="url(#ap_visor)" />
        {/* Visor Glint Reflection */}
        <Path d="M34 40 Q50 36 62 40" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
        <Circle cx="38" cy="54" r="3" fill="#FFFFFF" opacity="0.4" />
      </Svg>
    ),
  },
  {
    id: 'cyber_bot',
    name: 'Cyber Bot',
    bgGradient: ['#8B5CF6', '#312E81'],
    render: (size: number) => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="bot_bg" cx="40%" cy="30%" r="70%">
            <Stop offset="0%" stopColor="#C084FC" />
            <Stop offset="100%" stopColor="#2E1065" />
          </RadialGradient>
          <LinearGradient id="bot_metal" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#E2E8F0" />
            <Stop offset="60%" stopColor="#94A3B8" />
            <Stop offset="100%" stopColor="#475569" />
          </LinearGradient>
        </Defs>
        <Circle cx="50" cy="50" r="48" fill="url(#bot_bg)" />
        {/* Antenna */}
        <Rect x="48" y="14" width="4" height="12" rx="2" fill="#64748B" />
        <Circle cx="50" cy="14" r="5" fill="#38BDF8" />
        {/* Bot Head */}
        <Rect x="24" y="26" width="52" height="42" rx="14" fill="url(#bot_metal)" />
        {/* Screen Visor */}
        <Rect x="30" y="34" width="40" height="24" rx="8" fill="#0F172A" />
        {/* Glowing Eyes */}
        <Circle cx="40" cy="46" r="5" fill="#06B6D4" />
        <Circle cx="60" cy="46" r="5" fill="#06B6D4" />
        <Circle cx="39" cy="45" r="1.8" fill="#FFFFFF" />
        <Circle cx="59" cy="45" r="1.8" fill="#FFFFFF" />
        {/* Bot Smile */}
        <Path d="M42 60 Q50 64 58 60" stroke="#06B6D4" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* Neck & Body */}
        <Rect x="44" y="68" width="12" height="6" fill="#334155" />
        <Path d="M26 84 Q50 72 74 84 L76 100 L24 100 Z" fill="#64748B" />
      </Svg>
    ),
  },
  {
    id: 'fox_scout',
    name: 'Fox Scout',
    bgGradient: ['#F97316', '#7C2D12'],
    render: (size: number) => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="fox_bg" cx="40%" cy="30%" r="70%">
            <Stop offset="0%" stopColor="#FB923C" />
            <Stop offset="100%" stopColor="#7C2D12" />
          </RadialGradient>
          <RadialGradient id="fox_fur" cx="45%" cy="35%" r="60%">
            <Stop offset="0%" stopColor="#FB923C" />
            <Stop offset="70%" stopColor="#EA580C" />
            <Stop offset="100%" stopColor="#9A3412" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="48" fill="url(#fox_bg)" />
        {/* Ears */}
        <Path d="M26 34 L32 14 L50 28 Z" fill="#EA580C" />
        <Path d="M30 32 L34 20 L46 28 Z" fill="#FEF08A" />
        <Path d="M74 34 L68 14 L50 28 Z" fill="#EA580C" />
        <Path d="M70 32 L66 20 L54 28 Z" fill="#FEF08A" />
        {/* Cozy Beanie */}
        <Path d="M28 36 Q50 20 72 36 L70 46 Q50 36 30 46 Z" fill="#0284C7" />
        <Circle cx="50" cy="22" r="6" fill="#38BDF8" />
        {/* Head */}
        <Circle cx="50" cy="54" r="26" fill="url(#fox_fur)" />
        {/* White Snout */}
        <Path d="M38 56 Q50 48 62 56 L50 74 Z" fill="#FFFBEB" />
        {/* Eyes */}
        <Circle cx="39" cy="52" r="3.5" fill="#1C1917" />
        <Circle cx="61" cy="52" r="3.5" fill="#1C1917" />
        <Circle cx="38.5" cy="51" r="1.2" fill="#FFFFFF" />
        <Circle cx="60.5" cy="51" r="1.2" fill="#FFFFFF" />
        {/* Black Nose */}
        <Circle cx="50" cy="70" r="3" fill="#1C1917" />
      </Svg>
    ),
  },
  {
    id: 'pixel_ninja',
    name: 'Pixel Ninja',
    bgGradient: ['#059669', '#064E3B'],
    render: (size: number) => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="pn_bg" cx="40%" cy="30%" r="70%">
            <Stop offset="0%" stopColor="#34D399" />
            <Stop offset="100%" stopColor="#064E3B" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="48" fill="url(#pn_bg)" />
        {/* Ninja Hood */}
        <Circle cx="50" cy="50" r="30" fill="#18181B" />
        {/* Emerald Headband */}
        <Path d="M22 38 Q50 32 78 38 L76 46 Q50 40 24 46 Z" fill="#10B981" />
        <Rect x="44" y="38" width="12" height="6" rx="2" fill="#34D399" />
        {/* Face Opening */}
        <Rect x="34" y="46" width="32" height="14" rx="4" fill="#FED7AA" />
        {/* Focused Ninja Eyes */}
        <Path d="M38 52 L46 54" stroke="#18181B" strokeWidth="2.5" strokeLinecap="round" />
        <Path d="M62 52 L54 54" stroke="#18181B" strokeWidth="2.5" strokeLinecap="round" />
        <Circle cx="42" cy="54" r="2.5" fill="#18181B" />
        <Circle cx="58" cy="54" r="2.5" fill="#18181B" />
        <Circle cx="41.5" cy="53" r="1" fill="#FFFFFF" />
        <Circle cx="57.5" cy="53" r="1" fill="#FFFFFF" />
      </Svg>
    ),
  },
  {
    id: 'lion_blaze',
    name: 'Lion Blaze',
    bgGradient: ['#E11D48', '#881337'],
    render: (size: number) => (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="lb_bg" cx="40%" cy="30%" r="70%">
            <Stop offset="0%" stopColor="#FB7185" />
            <Stop offset="100%" stopColor="#881337" />
          </RadialGradient>
          <RadialGradient id="lb_mane" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#F59E0B" />
            <Stop offset="100%" stopColor="#B45309" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="48" fill="url(#lb_bg)" />
        {/* Mane */}
        <Circle cx="50" cy="50" r="34" fill="url(#lb_mane)" />
        {/* Ears */}
        <Circle cx="30" cy="30" r="8" fill="#FBBF24" />
        <Circle cx="70" cy="30" r="8" fill="#FBBF24" />
        {/* Face */}
        <Circle cx="50" cy="52" r="24" fill="#FDE68A" />
        {/* Sunglasses */}
        <Rect x="30" y="44" width="18" height="12" rx="3" fill="#1E293B" />
        <Rect x="52" y="44" width="18" height="12" rx="3" fill="#1E293B" />
        <Rect x="48" y="48" width="4" height="2" fill="#1E293B" />
        <Path d="M32 46 L44 46" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
        <Path d="M54 46 L66 46" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
        {/* Nose & Smile */}
        <Path d="M47 62 L53 62 L50 66 Z" fill="#B45309" />
        <Path d="M46 68 Q50 72 54 68" stroke="#92400E" strokeWidth="2" strokeLinecap="round" fill="none" />
      </Svg>
    ),
  },
];
