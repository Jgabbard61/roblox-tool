'use client';

import Image from 'next/image';

export default function PartnerFooter() {
  return (
    <footer className="bg-gray-900 text-white">
      {/* Partner section */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8">
            <h3 className="text-lg font-semibold text-gray-400 mb-2">Brought to you by</h3>
            <p className="text-sm text-gray-500">A collaboration between industry leaders in legal marketing</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
            {/* HaveALawyer */}
            <a 
              href="https://havealawyer.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex flex-col items-center"
            >
              <div className="h-20 bg-white rounded-xl flex items-center justify-center mb-3 group-hover:bg-gray-100 transition-all border border-white/20 group-hover:border-purple-500/50 px-6 py-3">
                <Image
                  src="/logos/havealawyer-logo.jpg"
                  alt="HaveALawyer"
                  width={200}
                  height={60}
                  className="h-14 w-auto object-contain"
                />
              </div>
              <span className="text-xs text-gray-500 group-hover:text-gray-400 transition">Legal Services Platform</span>
            </a>

            {/* X divider */}
            <div className="text-4xl font-light text-purple-500">×</div>

            {/* Direct Legal Marketing */}
            <a 
              href="https://directlegalmarketing.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex flex-col items-center"
            >
              <div className="h-20 bg-white/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-white/20 transition-all border border-white/10 group-hover:border-blue-500/50 px-6 py-3">
                <Image
                  src="/logos/dlm-logo-white.png"
                  alt="Direct Legal Marketing"
                  width={220}
                  height={60}
                  className="h-14 w-auto object-contain"
                />
              </div>
              <span className="text-xs text-gray-500 group-hover:text-gray-400 transition">Marketing Excellence</span>
            </a>
          </div>
        </div>
      </div>

      {/* Bottom footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">VL</span>
            </div>
            <span className="text-gray-400 text-sm">© 2025 VerifyLens. All rights reserved.</span>
          </div>
          
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <span>Powered by HaveALawyer & Direct Legal Marketing</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
