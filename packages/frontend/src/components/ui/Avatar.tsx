import React from 'react';

interface Props {
  name: string;
  photoUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

const ringSize = {
  xs: 'ring-1',
  sm: 'ring-1',
  md: 'ring-2',
  lg: 'ring-2',
  xl: 'ring-2',
};

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// Vibrant gradient pairs
const GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-cyan-500 to-blue-600',
  'from-teal-500 to-emerald-600',
  'from-green-500 to-teal-600',
  'from-orange-500 to-amber-500',
  'from-pink-500 to-rose-600',
  'from-rose-500 to-red-600',
];

function gradientFromName(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length]!;
}

export default function Avatar({ name, photoUrl, size = 'md', className = '' }: Props) {
  const sizeClass = sizes[size];
  const ringClass = ringSize[size];
  const gradient  = gradientFromName(name);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover ${ringClass} ring-border ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center text-white font-extrabold select-none shadow-sm ${className}`}
      title={name}
    >
      {initials(name)}
    </div>
  );
}
