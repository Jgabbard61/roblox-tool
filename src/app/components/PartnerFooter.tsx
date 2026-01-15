'use client';

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
              <div className="w-56 h-20 bg-white/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-white/20 transition-all border border-white/10 group-hover:border-purple-500/50 p-4">
                {/* HaveALawyer Logo */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {/* Scales of Justice Icon */}
                    <svg className="w-10 h-10 text-purple-400 group-hover:text-purple-300 transition" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L13.09 8.26L19 6L14.74 9.74L21 12L14.74 14.26L19 18L13.09 15.74L12 22L10.91 15.74L5 18L9.26 14.26L3 12L9.26 9.74L5 6L10.91 8.26L12 2Z" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-white group-hover:text-purple-300 transition leading-tight">HaveA</span>
                    <span className="text-xl font-bold text-purple-400 group-hover:text-purple-300 transition leading-tight">Lawyer</span>
                  </div>
                </div>
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
              <div className="w-56 h-20 bg-white/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-white/20 transition-all border border-white/10 group-hover:border-blue-500/50 p-4">
                {/* Direct Legal Marketing Logo */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {/* Marketing/Target Icon */}
                    <svg className="w-10 h-10 text-blue-400 group-hover:text-blue-300 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="6" />
                      <circle cx="12" cy="12" r="2" fill="currentColor" />
                      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white group-hover:text-blue-300 transition leading-tight">Direct Legal</span>
                    <span className="text-lg font-bold text-blue-400 group-hover:text-blue-300 transition leading-tight">Marketing</span>
                  </div>
                </div>
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
