import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Inkflow — Newsletter Platform with 0% Commission',
  description:
    'Keep 100% of your subscription revenue. Native SEO, AI writing assistant, and a flat SaaS fee. No success tax.',
};

const features = [
  {
    icon: '0%',
    title: '0% Commission',
    description:
      'We charge a flat monthly SaaS fee — not a cut of your revenue. At $10K/mo, you keep $10K, not $9K.',
  },
  {
    icon: 'SEO',
    title: 'Native SEO',
    description:
      'Every post is a server-rendered, SEO-optimised page. Structured data, canonical URLs, and LCP under 1.5s — built in.',
  },
  {
    icon: 'AI',
    title: 'AI Writing Assistant',
    description:
      'Draft, edit, and improve your posts with Claude — the same model powering Inkflow itself. 10 generations/hr included.',
  },
  {
    icon: '$',
    title: 'Flat Pricing',
    description:
      'Free → $29 → $79 → $149/mo. Unlimited subscribers on every paid plan. No hidden fees, no percentage cuts.',
  },
  {
    icon: '📧',
    title: 'Reliable Delivery',
    description:
      'Powered by Postmark with Resend as fallback. Industry-leading deliverability for transactional email.',
  },
  {
    icon: '📊',
    title: 'Analytics',
    description:
      'Open rates, click rates, subscriber growth — all in one dashboard. No third-party trackers required.',
  },
];

const plans = [
  { name: 'Free', price: '$0', limit: 'Up to 500 subscribers', cta: 'Get started free' },
  {
    name: 'Starter',
    price: '$29/mo',
    limit: 'Up to 5,000 subscribers',
    cta: 'Start Starter',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$79/mo',
    limit: 'Up to 25,000 subscribers',
    cta: 'Go Pro',
    highlight: true,
  },
  {
    name: 'Scale',
    price: '$149/mo',
    limit: 'Unlimited subscribers',
    cta: 'Scale up',
    highlight: false,
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="border-b border-gray-100 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold text-sky-600">Inkflow</span>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700"
            >
              Start free
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-sky-50 to-white py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="mb-4 inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            Blue Ocean — No competitor combines all three
          </div>
          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight text-gray-900 sm:text-6xl">
            Publish newsletters.
            <br />
            <span className="text-sky-600">Keep 100% of your revenue.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-600">
            Inkflow charges a flat monthly fee — never a percentage of your earnings. Native SEO
            gets your posts discovered. The AI writing assistant helps you publish faster.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="rounded-xl bg-sky-600 px-8 py-4 text-base font-semibold text-white shadow-md transition-colors hover:bg-sky-700"
            >
              Start free — no credit card
            </Link>
            <Link
              href="#pricing"
              className="rounded-xl border border-gray-300 bg-white px-8 py-4 text-base font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500">Free plan includes 500 subscribers forever</p>
        </div>
      </section>

      {/* vs Substack callout */}
      <section className="border-y border-gray-100 bg-white py-12">
        <div className="mx-auto max-w-4xl px-6">
          <div className="rounded-2xl bg-gray-50 p-8">
            <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">
              The success tax is real
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="text-center">
                <p className="mb-1 text-3xl font-bold text-gray-400 line-through">$1,000/mo</p>
                <p className="text-sm text-gray-500">Substack takes 10% at $10K/mo revenue</p>
              </div>
              <div className="flex items-center justify-center text-3xl font-bold text-gray-400">
                vs
              </div>
              <div className="text-center">
                <p className="mb-1 text-3xl font-bold text-sky-600">$149/mo</p>
                <p className="text-sm text-gray-500">Inkflow flat fee — unlimited subscribers</p>
              </div>
            </div>
            <p className="mt-6 text-center text-sm text-gray-500">
              At $10K/mo revenue, Inkflow saves you $851/mo — $10,212/yr
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900">Everything a newsletter needs</h2>
            <p className="text-lg text-gray-600">
              Built for writers who want to own their audience and their economics.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-lg font-bold text-sky-600">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900">Simple, flat pricing</h2>
            <p className="text-lg text-gray-600">No percentage cuts. No surprises. Cancel anytime.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 ${
                  plan.highlight
                    ? 'border-2 border-sky-500 bg-sky-600 text-white shadow-lg'
                    : 'border border-gray-200 bg-white text-gray-900 shadow-sm'
                }`}
              >
                {plan.highlight && (
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-sky-200">
                    Most popular
                  </div>
                )}
                <p
                  className={`text-lg font-bold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}
                >
                  {plan.name}
                </p>
                <p
                  className={`my-2 text-3xl font-bold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}
                >
                  {plan.price}
                </p>
                <p className={`mb-6 text-sm ${plan.highlight ? 'text-sky-100' : 'text-gray-500'}`}>
                  {plan.limit}
                </p>
                <Link
                  href="/register"
                  className={`block rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
                    plan.highlight
                      ? 'bg-white text-sky-600 hover:bg-sky-50'
                      : 'bg-sky-600 text-white hover:bg-sky-700'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900">
            Ready to stop paying the success tax?
          </h2>
          <p className="mb-8 text-lg text-gray-600">
            Start free. No credit card required. Upgrade when you're ready.
          </p>
          <Link
            href="/register"
            className="inline-flex rounded-xl bg-sky-600 px-10 py-4 text-base font-semibold text-white shadow-md transition-colors hover:bg-sky-700"
          >
            Create your newsletter
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-100 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-gray-500">
          <p>
            &copy; {new Date().getFullYear()} Inkflow. Built with Next.js, Fastify, and the Claude
            API.
          </p>
        </div>
      </footer>
    </div>
  );
}
