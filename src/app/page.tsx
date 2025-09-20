"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const PremiumCryptoLanding: React.FC = () => {
  const router = useRouter();
  const particlesRef = useRef<HTMLDivElement>(null);

  // Particle system
  useEffect(() => {
    const createParticle = () => {
      if (!particlesRef.current) return;

      const particle = document.createElement("div");
      particle.className =
        "absolute rounded-full bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-400 pointer-events-none opacity-20 animate-fade-in-out";
      const size = Math.random() * 3 + 2;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      particle.style.animationDuration = `${Math.random() * 5 + 3}s`;

      particlesRef.current.appendChild(particle);
      setTimeout(() => particle.remove(), 8000);
    };

    const intervalId = setInterval(createParticle, 300);
    return () => clearInterval(intervalId);
  }, []);

  const handleSignIn = () => router.push("/sign-in");
  const handleSignUp = () => router.push("/sign-up");

  return (
    <div className="relative overflow-x-hidden min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-pink-900">
      {/* Particle background */}
      <div ref={particlesRef} className="fixed inset-0 z-0 pointer-events-none" />

      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center text-center pt-36 pb-24 px-6 z-10">
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-white leading-tight">
          Take Control of Your{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            Crypto Future
          </span>
        </h1>
        <p className="text-gray-300 mt-6 max-w-2xl">
          Manage, trade, and stake your assets with confidence. A premium crypto wallet
          experience for modern investors.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleSignUp}
            className="px-8 py-4 rounded-3xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-lg hover:scale-105 shadow-2xl transition-transform duration-200"
          >
            Get Started Free
          </button>
          <button className="px-8 py-4 rounded-3xl bg-white/10 backdrop-blur-lg border border-white/20 text-white font-semibold hover:bg-white/20 transition duration-200">
            Watch Demo
          </button>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-6 max-w-2xl mx-auto text-white">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold">$2.5B+</span>
            <span className="text-sm text-gray-400">Secured</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold">150+</span>
            <span className="text-sm text-gray-400">Tokens</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold">99.9%</span>
            <span className="text-sm text-gray-400">Uptime</span>
          </div>
        </div>

        {/* Phone Mockup */}
        <div className="mt-16 relative w-full max-w-xs mx-auto">
          <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 rounded-3xl p-2 shadow-2xl relative overflow-hidden h-[480px]">
            <div className="bg-black/20 rounded-2xl w-full h-full p-4 flex flex-col justify-between">
              <div className="text-white font-bold text-center text-2xl mt-8">$24,563.89</div>
              <div className="space-y-3">
                {["BTC", "ETH", "SOL"].map((coin) => (
                  <div
                    key={coin}
                    className="flex justify-between items-center bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 text-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold">
                        {coin[0]}
                      </div>
                      <span className="font-semibold">{coin}</span>
                    </div>
                    <span>$1234</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-4">
                <button className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition">Send</button>
                <button className="flex-1 py-2 rounded-lg bg-white/10 backdrop-blur-lg border border-white/20 hover:bg-white/20 transition">Receive</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-3 gap-8 text-white">
          {[
            { title: "Bank-Grade Security", desc: "Multi-layer encryption and biometric authentication.", gradient: "from-indigo-500 to-purple-600" },
            { title: "Lightning Fast", desc: "Execute trades and transfers in seconds.", gradient: "from-green-500 to-teal-600" },
            { title: "Multi-Chain Support", desc: "Manage assets across Ethereum, BSC, Polygon, and more.", gradient: "from-blue-500 to-cyan-600" },
          ].map((f, idx) => (
            <div
              key={idx}
              className={`p-6 rounded-2xl bg-gradient-to-br ${f.gradient} shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300`}
            >
              <h3 className="font-bold text-xl mb-2">{f.title}</h3>
              <p className="text-sm opacity-80">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-center text-white">
        <h2 className="text-4xl font-bold mb-4">Ready to Start?</h2>
        <p className="text-gray-300 mb-8">Join millions who trust Crypto Premium Wallet.</p>
        <button
          onClick={handleSignUp}
          className="px-10 py-4 rounded-3xl bg-white text-indigo-900 font-bold hover:scale-105 shadow-2xl transition transform duration-200"
        >
          Create Free Account
        </button>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-black text-gray-400 text-center">
        <p>© 2024 Crypto Premium Wallet. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default PremiumCryptoLanding;
