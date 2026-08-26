'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginAdmin } from '@/app/actions/auth';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const res = await loginAdmin({ email, password });

    if (res?.error) {
      setErrorMsg(res.error);
      setLoading(false);
      return;
    }

    router.push('/admin/dashboard');
    router.refresh();
  };

  return (
    <div className="fixed inset-0 bg-[#2C3527] flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-8 sm:p-10 w-full max-w-[380px] shadow-2xl">
        <h1 className="text-2xl font-serif tracking-[0.25em] text-center text-[#1A1F16] mb-8 select-none">
          KORA
        </h1>

        <form onSubmit={handleLogin} className="space-y-5">
          {errorMsg && (
            <div className="p-3 text-xs bg-[#F8E9E6] border border-[#D9A79C] text-[#8C3226] rounded-lg">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium tracking-wider uppercase text-[#7A7269] mb-1.5">
              Email or username
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="daphne@daysinkora.com"
              className="w-full px-3.5 py-2.5 text-sm bg-[#FDFCFA] border border-[#E5E0D6] rounded-lg text-[#221E19] placeholder-[#B4ACA0] focus:outline-none focus:ring-2 focus:ring-[#CAD3C5] focus:border-[#2C3527] transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium tracking-wider uppercase text-[#7A7269] mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 text-sm bg-[#FDFCFA] border border-[#E5E0D6] rounded-lg text-[#221E19] placeholder-[#B4ACA0] focus:outline-none focus:ring-2 focus:ring-[#CAD3C5] focus:border-[#2C3527] transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#262F22] hover:bg-[#1A1F16] text-[#F5F2EC] text-sm font-medium rounded-lg transition duration-150 disabled:opacity-50 mt-2 cursor-pointer"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
