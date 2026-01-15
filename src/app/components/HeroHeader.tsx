'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function HeroHeader() {
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <header className="relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHN0cm9rZS13aWR0aD0iMiIvPjwvZz48L3N2Zz4=')] opacity-30"></div>
        {/* Floating orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500 rounded-full filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-400 rounded-full filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Top navigation bar */}
      <nav className="relative z-10 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                <span className="text-white font-bold text-xl">VL</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-purple-900"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                Verify<span className="text-purple-300">Lens</span>
              </h1>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            {/* Free tool badge */}
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-sm text-white/90 font-medium">Free Tool</span>
            </div>
            
            {/* Admin button */}
            {session?.user?.role === 'SUPER_ADMIN' && (
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all font-medium border border-white/20 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Collaboration badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 mb-6">
            <span className="text-purple-300 text-sm font-medium">A collaboration by</span>
            <div className="flex items-center gap-2">
              <a href="https://havealawyer.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-purple-300 transition font-semibold text-sm">
                HaveALawyer
              </a>
              <span className="text-purple-400">×</span>
              <a href="https://directlegalmarketing.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-purple-300 transition font-semibold text-sm">
                Direct Legal Marketing
              </a>
            </div>
          </div>

          {/* Main title */}
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-4">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-blue-200">
              Roblox Username
            </span>
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-blue-300">
              Verification Tool
            </span>
          </h2>

          {/* Tagline */}
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-8">
            Your trusted partner for instant Roblox username verification.
            <span className="block mt-2 text-purple-300">Fast, accurate, and completely free.</span>
          </p>

          {/* Stats/trust indicators */}
          <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-white">100%</div>
              <div className="text-sm text-white/60">Free to Use</div>
            </div>
            <div className="w-px h-12 bg-white/20 hidden sm:block"></div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-white">25</div>
              <div className="text-sm text-white/60">Searches/Hour</div>
            </div>
            <div className="w-px h-12 bg-white/20 hidden sm:block"></div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-white">Instant</div>
              <div className="text-sm text-white/60">Results</div>
            </div>
          </div>
        </div>
      </div>

      {/* Wave separator */}
      <div className="relative z-10">
        <svg className="w-full h-16 sm:h-24" viewBox="0 0 1440 100" fill="none" preserveAspectRatio="none">
          <path d="M0,50 C360,100 720,0 1080,50 C1260,75 1380,75 1440,50 L1440,100 L0,100 Z" fill="#f8fafc" />
        </svg>
      </div>
    </header>
  );
}
