import { useState } from "react";

// ═══════════════════════════════════════════════════════════════
// DATA: WHOOP Analogue CJM — Generated from M2 Analysis
// Company: WHOOP Analogue ("PulseOS")
// Industry: Fitness Wearables / Health Tech
// ═══════════════════════════════════════════════════════════════

const VARIANTS = {
  A: {
    name: "Спортивный Тренер",
    emoji: "🏃",
    col: "emerald",
    bg: "bg-emerald-600",
    bgl: "bg-emerald-50",
    bdr: "border-emerald-500",
    txt: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-800",
    landing: {
      hl: "Тренируешься 5 дней в неделю, но не растёшь?",
      sub: "PulseOS анализирует твоё восстановление и говорит: когда жать на газ, когда — нет. С GPS и адаптацией под твой вид спорта.",
      cta: "Узнать почему",
      hero_stat: "Recovery Score 67%",
      hero_sub: "Средний бегун тренируется на 40% усилий когда можно было 80%",
    },
    onboarding: {
      q1: "Какой твой основной вид спорта?",
      q1_opts: ["Бег", "Велоспорт", "CrossFit", "Триатлон", "Силовой"],
      q2: "Сколько тренировок в неделю?",
      q2_opts: ["2-3 раза", "4-5 раз", "6+ раз (серьёзный атлет)"],
      q3: "Какая главная цель?",
      q3_opts: ["Личный рекорд", "Здоровье и долголетие", "Похудение", "Подготовка к соревнованию"],
      style: "Спортивный квиз с прогресс-баром",
    },
    aha: {
      title: "Твой Recovery Score: 67%",
      desc: "Вчера CrossFit 4x5 back squat → HRV упал на 18%. Сегодня рекомендация: кардио до 75% ЧСС, без высоких весов.",
      wow: "⚡ ВОТ ПОЧЕМУ вчерашняя тренировка была такой тяжёлой",
      kpi: "Recovery за 7 дней • Strain по дням • GPS трек",
      day: "День 2 утром",
    },
    dash: {
      hook: "Утренний Recovery Score (6:00-8:00)",
      lesson: "🏅 Сегодня можно на 80% — беги интервалы",
      stats: ["Recovery: 67% 🟡", "Strain вчера: 14.2", "HRV: 52ms ↓5"],
      gps: "📍 Вчерашний трек: 8.4 км, avg HR 154bpm",
    },
    pay: {
      when: "День 14 (привычка 2 недели)",
      frame: "Ты уже видел как это работает. Теперь открой AI-тренера для [Бег/CrossFit/...] — персональный план на следующие 90 дней.",
      price: "$15/мес Sport · $20/мес Pro с AI Coach",
      cta: "Начать тренироваться умнее",
    },
    inv: {
      hook: "Пригласи тренировочного партнёра",
      mech: "Оба получаете +1 месяц бесплатно. Сравнивайте Recovery после совместных тренировок.",
      copy: "«Попробуй PulseOS — я наконец понял почему перетренировался»",
    },
  },

  B: {
    name: "Биохакер",
    emoji: "🧬",
    col: "violet",
    bg: "bg-violet-600",
    bgl: "bg-violet-50",
    bdr: "border-violet-500",
    txt: "text-violet-700",
    badge: "bg-violet-100 text-violet-800",
    landing: {
      hl: "Узнай свой биологический возраст. Замедли старение с данными.",
      sub: "PulseOS рассчитывает твой PULSE Age на основе HRV, сна, ЧСС и восстановления. Данные каждый день. Прогресс каждую неделю.",
      cta: "Рассчитать PULSE Age",
      hero_stat: "PULSE Age: 31",
      hero_sub: "Хронологический возраст: 35 • Ты замедляешь старение на 4 года",
    },
    onboarding: {
      q1: "Твоя главная цель?",
      q1_opts: ["Прожить дольше и здоровее", "Оптимизировать производительность", "Следить за метриками здоровья"],
      q2: "Что уже отслеживаешь?",
      q2_opts: ["Ничего нового", "Сон и стресс", "HRV и ЧСС", "Всё подряд (Oura, WHOOP, CGM)"],
      q3: "Вдохновение откуда?",
      q3_opts: ["Peter Attia / 'Outlive'", "Andrew Huberman", "Bryan Johnson", "Другой источник"],
      style: "Минималистичный научный квиз",
    },
    aha: {
      title: "PULSE Age: 31.4 года",
      desc: "Твой хронологический возраст: 35. Данные HRV, сна и восстановления за 3 дня показывают: твоё тело на 3.6 года моложе.",
      wow: "🧬 9 биомаркеров • 3 дня данных • 1 число",
      kpi: "Pace of Aging • PULSE Age trends • 9 метрик",
      day: "День 3 (после первых 3 суток данных)",
    },
    dash: {
      hook: "Еженедельный PULSE Age Update",
      lesson: "📊 Эта неделя: твой PULSE Age снизился на 0.2 года благодаря улучшению сна",
      stats: ["PULSE Age: 31.4 🟢", "HRV trend: ↑7% за неделю", "Deep Sleep: 18% → 22%"],
      gps: "🔬 Correlation: алкоголь в пятницу → -0.4 PULSE Age за 2 дня",
    },
    pay: {
      when: "День 3 (сразу после первого PULSE Age — на Aha-эмоции)",
      frame: "Твой PULSE Age рассчитан. Чтобы отслеживать прогресс и получать персональные рекомендации — включи Pro план.",
      price: "$20/мес Pro • $359/год Life (с ECG)",
      cta: "Отслеживать биологический возраст",
    },
    inv: {
      hook: "Сравни PULSE Age с другом-биохакером",
      mech: "Пригласи → оба видите сравнение PULSE Age. Кто «моложе»? Friendly competition на данных.",
      copy: "«Мой биологический возраст 31 при хронологическом 35. Проверь свой.»",
    },
  },

  C: {
    name: "Производительность",
    emoji: "⚡",
    col: "blue",
    bg: "bg-blue-600",
    bgl: "bg-blue-50",
    bdr: "border-blue-500",
    txt: "text-blue-700",
    badge: "bg-blue-100 text-blue-800",
    landing: {
      hl: "Работаешь 60+ часов в неделю? Твоё тело накапливает долг.",
      sub: "PulseOS измеряет как стресс, плохой сон и перегрузка влияют на твою продуктивность. Данные о теле в терминах бизнеса.",
      cta: "Измерить стресс-нагрузку",
      hero_stat: "Stress Score: 2.1/3",
      hero_sub: "Высокий стресс крадёт ~2.3 часа продуктивности каждый день",
    },
    onboarding: {
      q1: "Сколько часов ты работаешь в неделю?",
      q1_opts: ["40-50 часов", "50-60 часов", "60-80 часов", "80+ часов"],
      q2: "Главная проблема?",
      q2_opts: ["Нет энергии после 15:00", "Сложно выключиться вечером", "Частые болезни", "Нарушен сон"],
      q3: "Роль / профессия?",
      q3_opts: ["Топ-менеджер / CEO", "Предприниматель", "Консультант / Врач / Юрист", "Другое"],
      style: "Деловой минимализм, без игривости",
    },
    aha: {
      title: "Отчёт за первую неделю: Stress Profile",
      desc: "Пиковая продуктивность: Вт-Ср 9:00-12:00. Stress peak: Пн и Чт вечер. Сон в пятницу -42 мин от нормы → суббота -18% Recovery.",
      wow: "📊 Вот твой паттерн продуктивности на основе данных тела",
      kpi: "Stress timeline • Продуктивное окно • Sleep debt",
      day: "День 7 (после полной недели данных)",
    },
    dash: {
      hook: "Еженедельный Performance Report",
      lesson: "💼 Лучшее время для стратегических решений: Вт 9-12. Meetings лучше на вторую половину.",
      stats: ["Avg Stress: 2.1 🟠 (высокий)", "Продуктивное окно: +2.1 ч/день", "Recovery avg: 58%"],
      gps: "📅 Calendar sync: матчим Recovery Score с calendar — Heavy meeting days = высокий Strain",
    },
    pay: {
      when: "День 7 (после первого Performance Report — proof of value)",
      frame: "Ты видел свой паттерн продуктивности. Продолжи отслеживать и получи AI-рекомендации по schedule optimization.",
      price: "$20/мес Pro · $250/чел/год Enterprise (от 5 чел)",
      cta: "Оптимизировать производительность",
    },
    inv: {
      hook: "Корпоративный wellness trial",
      mech: "5 коллег → бесплатный месяц для всей команды. Team Recovery Dashboard для HR.",
      copy: "«Узнал что мои 60-часовые рабочие недели реально стоят моему телу. Попробуй.»",
    },
  },
};

// ═══ CJM METADATA (stage annotations) ═══
const CJM_META = {
  landing:   { stage: "Awareness",    aarrr: "Acquisition", q: "Резонирует ли проблема? Хочется кликнуть?" },
  onboarding:{ stage: "Activation",   aarrr: "Activation",  q: "Понятны ли вопросы? Угадывает ли наш сегмент?" },
  aha:       { stage: "Aha Moment",   aarrr: "Activation",  q: "WOW? Хочется показать другу?" },
  dash:      { stage: "Engagement",   aarrr: "Retention",   q: "Вернётся ли завтра? Есть ли hook?" },
  pay:       { stage: "Monetisation", aarrr: "Revenue",     q: "Понятна ли ценность? Цена ок?" },
  inv:       { stage: "Amplification",aarrr: "Referral",    q: "Хочется ли пригласить? Механика ясна?" },
};

const SCREENS = ["landing","onboarding","aha","dash","pay","inv"];
const SCREEN_LABELS = {
  landing: "🌐 Landing",
  onboarding: "📋 Onboarding",
  aha: "⚡ Aha Moment",
  dash: "📊 Dashboard",
  pay: "💳 Paywall",
  inv: "🤝 Referral",
};

// ═══ BUILDER CONFIG ═══
const defaultMix = { landing:"A", onboarding:"A", aha:"A", dash:"A", pay:"A", inv:"A" };

export default function WHOOPCJMPrototype() {
  const [activeVariant, setActiveVariant] = useState("A");
  const [activeScreen, setActiveScreen] = useState("landing");
  const [showCJM, setShowCJM] = useState(false);
  const [mode, setMode] = useState("variants"); // variants | compare | builder | locked
  const [mix, setMix] = useState(defaultMix);
  const [locked, setLocked] = useState(null);
  const [scores, setScores] = useState({ A: {}, B: {}, C: {} });

  const v = VARIANTS[activeVariant];
  const meta = CJM_META[activeScreen];

  const getScreen = (varKey, screen) => VARIANTS[varKey];

  const renderScreen = (varKey, screen) => {
    const vd = VARIANTS[varKey];
    switch (screen) {
      case "landing":
        return (
          <div className={`rounded-2xl overflow-hidden shadow-xl ${vd.bgl} border ${vd.bdr}`}>
            <div className={`${vd.bg} text-white p-6`}>
              <div className="text-xs uppercase tracking-widest opacity-80 mb-2">PulseOS · {vd.emoji} {vd.name}</div>
              <h1 className="text-2xl font-bold leading-tight mb-3">{vd.landing.hl}</h1>
              <p className="text-sm opacity-90 mb-5">{vd.landing.sub}</p>
              <div className="bg-white/20 rounded-xl p-3 mb-5">
                <div className="text-3xl font-black">{vd.landing.hero_stat}</div>
                <div className="text-xs opacity-80 mt-1">{vd.landing.hero_sub}</div>
              </div>
              <button className="w-full bg-white text-gray-900 font-bold py-3 px-6 rounded-xl text-sm hover:bg-gray-50 transition">
                {vd.landing.cta} →
              </button>
            </div>
          </div>
        );
      case "onboarding":
        return (
          <div className={`rounded-2xl p-5 ${vd.bgl} border ${vd.bdr} space-y-4`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{vd.emoji}</span>
              <span className={`text-sm font-semibold ${vd.txt}`}>Настройка PulseOS · Шаг 1/3</span>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="font-semibold text-gray-800 mb-3">{vd.onboarding.q1}</p>
              <div className="grid grid-cols-2 gap-2">
                {vd.onboarding.q1_opts.map(o => (
                  <button key={o} className={`text-xs py-2 px-3 rounded-lg border ${vd.bdr} ${vd.txt} bg-white hover:${vd.bgl} transition font-medium`}>{o}</button>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm opacity-60">
              <p className="font-semibold text-gray-800 mb-2">{vd.onboarding.q2}</p>
              <div className="flex flex-wrap gap-2">
                {vd.onboarding.q2_opts.map(o => (
                  <span key={o} className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">{o}</span>
                ))}
              </div>
            </div>
            <p className={`text-xs ${vd.txt} text-center italic`}>{vd.onboarding.style}</p>
          </div>
        );
      case "aha":
        return (
          <div className={`rounded-2xl overflow-hidden shadow-xl`}>
            <div className={`${vd.bg} text-white p-5`}>
              <div className="text-xs uppercase tracking-widest opacity-70 mb-1">⚡ {vd.aha.day}</div>
              <h2 className="text-3xl font-black mb-1">{vd.aha.title}</h2>
              <div className="text-sm opacity-90">{vd.aha.kpi}</div>
            </div>
            <div className={`${vd.bgl} p-5 space-y-3`}>
              <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-yellow-400">
                <div className="text-lg font-bold text-yellow-700 mb-1">{vd.aha.wow}</div>
                <p className="text-sm text-gray-700">{vd.aha.desc}</p>
              </div>
              <button className={`w-full ${vd.bg} text-white font-bold py-3 rounded-xl text-sm hover:opacity-90 transition`}>
                Подробнее →
              </button>
            </div>
          </div>
        );
      case "dash":
        return (
          <div className={`rounded-2xl p-5 ${vd.bgl} border ${vd.bdr} space-y-3`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`font-bold ${vd.txt}`}>{vd.emoji} PulseOS · Dashboard</span>
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">Вторник, 07:02</span>
            </div>
            <div className={`${vd.bg} text-white rounded-xl p-4`}>
              <div className="text-xs opacity-70 mb-1">🔔 {vd.dash.hook}</div>
              <div className="text-lg font-bold">{vd.dash.lesson}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {vd.dash.stats.map(s => (
                <div key={s} className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <div className="text-xs text-gray-500 font-medium">{s}</div>
                </div>
              ))}
            </div>
            <div className={`bg-white rounded-xl p-3 border ${vd.bdr} text-xs ${vd.txt} font-medium`}>
              {vd.dash.gps}
            </div>
          </div>
        );
      case "pay":
        return (
          <div className={`rounded-2xl overflow-hidden shadow-xl`}>
            <div className={`${vd.bg} text-white p-5 text-center`}>
              <div className="text-4xl mb-2">💳</div>
              <div className="text-xs uppercase tracking-widest opacity-70 mb-1">{vd.pay.when}</div>
              <h2 className="text-xl font-bold">{vd.pay.frame}</h2>
            </div>
            <div className={`${vd.bgl} p-5 space-y-3`}>
              <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                <div className={`text-lg font-black ${vd.txt}`}>{vd.pay.price}</div>
                <div className="text-xs text-gray-500 mt-1">Устройство включено · Отменить в любой момент</div>
              </div>
              <button className={`w-full ${vd.bg} text-white font-bold py-3 rounded-xl hover:opacity-90 transition`}>
                {vd.pay.cta} →
              </button>
              <p className="text-xs text-gray-500 text-center">Без hidden fees · Прозрачные условия</p>
            </div>
          </div>
        );
      case "inv":
        return (
          <div className={`rounded-2xl p-5 ${vd.bgl} border ${vd.bdr} space-y-4`}>
            <div className="text-center">
              <div className="text-4xl mb-2">🤝</div>
              <h2 className={`text-lg font-bold ${vd.txt}`}>{vd.inv.hook}</h2>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-sm text-gray-700 mb-3">{vd.inv.mech}</p>
              <div className="bg-gray-50 rounded-lg p-3 border border-dashed border-gray-300">
                <p className="text-xs text-gray-600 italic">"{vd.inv.copy}"</p>
              </div>
            </div>
            <button className={`w-full ${vd.bg} text-white font-bold py-3 rounded-xl text-sm hover:opacity-90 transition`}>
              Пригласить →
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const handleLock = (choice) => {
    setLocked(choice);
    setMode("locked");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-gray-900">🌀 PulseOS · CJM Prototype</h1>
          <p className="text-sm text-gray-500">WHOOP Analogue · 3 Variant Hypotheses · DEEP Mode</p>
        </div>

        {/* Mode Switcher */}
        <div className="flex gap-2 mb-5 bg-white rounded-xl p-1 shadow-sm">
          {[["variants","🎭 Варианты"],["compare","⚖️ Сравнение"],["builder","🔧 Конструктор"]].map(([m,l]) => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode===m ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              {l}
            </button>
          ))}
        </div>

        {/* ═══ MODE: VARIANTS ═══ */}
        {mode === "variants" && (
          <>
            {/* Variant Tabs */}
            <div className="flex gap-2 mb-4">
              {Object.entries(VARIANTS).map(([key, vd]) => (
                <button key={key} onClick={() => setActiveVariant(key)}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition border-2 ${
                    activeVariant===key ? `${vd.bg} text-white border-transparent` : `bg-white ${vd.txt} ${vd.bdr} hover:${vd.bgl}`
                  }`}>
                  {vd.emoji} {key}: {vd.name}
                </button>
              ))}
            </div>

            {/* Screen Nav */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
              {SCREENS.map(s => (
                <button key={s} onClick={() => setActiveScreen(s)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeScreen===s ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-200"
                  }`}>
                  {SCREEN_LABELS[s]}
                </button>
              ))}
            </div>

            {/* Screen Render */}
            <div className="mb-4">{renderScreen(activeVariant, activeScreen)}</div>

            {/* CJM Overlay Toggle */}
            <button onClick={() => setShowCJM(!showCJM)}
              className={`w-full py-2 rounded-xl text-sm font-semibold mb-4 transition ${showCJM ? "bg-indigo-600 text-white" : "bg-white text-indigo-600 border border-indigo-300"}`}>
              📊 {showCJM ? "Скрыть CJM аннотации" : "Показать CJM аннотации"}
            </button>

            {showCJM && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 text-sm space-y-1">
                <div className="font-bold text-indigo-800 mb-2">📊 CJM · {SCREEN_LABELS[activeScreen]}</div>
                <div><span className="font-medium">Этап:</span> {meta.stage}</div>
                <div><span className="font-medium">AARRR:</span> {meta.aarrr}</div>
                <div className="mt-2 bg-white rounded-lg p-3 border border-indigo-200">
                  <div className="text-xs text-indigo-700 font-medium">🔬 Custdev вопрос:</div>
                  <div className="text-gray-700 mt-1">{meta.q}</div>
                </div>
              </div>
            )}

            {/* Lock Variant */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-700 mb-3">Выбрать вариант как winning CJM:</p>
              <div className="flex gap-2">
                {Object.keys(VARIANTS).map(k => (
                  <button key={k} onClick={() => handleLock(k)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold text-white ${VARIANTS[k].bg} hover:opacity-90 transition`}>
                    ✅ {k}: {VARIANTS[k].name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ═══ MODE: COMPARE ═══ */}
        {mode === "compare" && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-gray-900 text-white p-4 text-center font-bold">⚖️ Сравнение вариантов</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-3 text-left text-gray-500">Параметр</th>
                    {Object.entries(VARIANTS).map(([k,vd]) => (
                      <th key={k} className="p-3 text-center">
                        <div className={`inline-block px-2 py-1 rounded-lg ${vd.badge} font-bold`}>{vd.emoji} {k}</div>
                        <div className="text-gray-600 font-normal mt-1">{vd.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Entry Hook", k => VARIANTS[k].landing.hl.substring(0,50)+"…"],
                    ["Aha Moment", k => VARIANTS[k].aha.title],
                    ["Aha День", k => VARIANTS[k].aha.day],
                    ["Paywall Timing", k => VARIANTS[k].pay.when],
                    ["Referral Hook", k => VARIANTS[k].inv.hook],
                    ["Best Segment", k => ({A:"Серьёзный атлет",B:"Longevity enthusiast",C:"Топ-профессионал"}[k])],
                  ].map(([label, fn], i) => (
                    <tr key={label} className={i%2===0 ? "bg-white" : "bg-gray-50"}>
                      <td className="p-3 font-medium text-gray-700">{label}</td>
                      {Object.keys(VARIANTS).map(k => (
                        <td key={k} className="p-3 text-gray-600 text-center">{fn(k)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t">
              <p className="text-xs text-gray-500 mb-3 text-center">Выбери winning вариант:</p>
              <div className="flex gap-2">
                {Object.entries(VARIANTS).map(([k,vd]) => (
                  <button key={k} onClick={() => handleLock(k)}
                    className={`flex-1 py-2 text-white text-sm font-bold rounded-xl ${vd.bg} hover:opacity-90 transition`}>
                    ✅ {k}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ MODE: BUILDER ═══ */}
        {mode === "builder" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="font-bold text-gray-800 mb-3">🔧 Конструктор: выбери лучший экран из каждого варианта</div>
              {SCREENS.map(screen => (
                <div key={screen} className="mb-4">
                  <div className="text-sm font-semibold text-gray-600 mb-2">{SCREEN_LABELS[screen]}</div>
                  <div className="flex gap-2">
                    {Object.entries(VARIANTS).map(([k,vd]) => (
                      <button key={k} onClick={() => setMix(prev => ({...prev, [screen]: k}))}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition border-2 ${
                          mix[screen]===k ? `${vd.bg} text-white border-transparent` : `bg-white ${vd.txt} ${vd.bdr}`
                        }`}>
                        {vd.emoji} {k}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Preview custom mix */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="font-bold text-gray-800 mb-3">👁 Preview: твой кастомный CJM</div>
              <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
                {SCREENS.map(s => (
                  <button key={s} onClick={() => setActiveScreen(s)}
                    className={`whitespace-nowrap px-2 py-1 rounded-lg text-xs font-medium transition ${
                      activeScreen===s ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
                    }`}>
                    {SCREEN_LABELS[s]} <span className={`${VARIANTS[mix[s]].txt} font-bold`}>({mix[s]})</span>
                  </button>
                ))}
              </div>
              {renderScreen(mix[activeScreen], activeScreen)}
            </div>
            <button onClick={() => handleLock("custom")}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition">
              ✅ Зафиксировать кастомный CJM
            </button>
          </div>
        )}

        {/* ═══ MODE: LOCKED ═══ */}
        {mode === "locked" && locked && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gray-900 text-white p-5 text-center">
              <div className="text-4xl mb-2">✅</div>
              <h2 className="text-xl font-bold">
                Winning CJM: {locked === "custom" ? "🔧 Кастомный микс" : `${VARIANTS[locked].emoji} Вариант ${locked} — "${VARIANTS[locked]?.name}"`}
              </h2>
            </div>
            <div className="p-5 space-y-4">
              {locked !== "custom" && (
                <>
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <div className="font-semibold text-green-800 mb-2">🎯 Выбранная стратегия</div>
                    <div className="text-sm text-gray-700 space-y-1">
                      <div><b>Aha Moment:</b> {VARIANTS[locked].aha.title} ({VARIANTS[locked].aha.day})</div>
                      <div><b>Paywall:</b> {VARIANTS[locked].pay.when}</div>
                      <div><b>Referral:</b> {VARIANTS[locked].inv.hook}</div>
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 text-sm">
                    <div className="font-semibold text-blue-800 mb-2">📦 Передаётся в Phase 1 (SPARC Planning)</div>
                    <div className="text-gray-700 space-y-1">
                      <div>→ <b>M3:</b> Aha "{VARIANTS[locked].aha.title}" используется в competitive comparison</div>
                      <div>→ <b>M4:</b> Paywall {VARIANTS[locked].pay.when} → конверсия в revenue model</div>
                      <div>→ <b>M5:</b> Loop type "{locked === "A" ? "Community/Sport" : locked === "B" ? "Data/Longevity" : "B2B/Enterprise"}" → growth engine</div>
                      <div>→ <b>MVP scope:</b> 6 экранов winning CJM = Phase 1 PRD scope</div>
                    </div>
                  </div>
                </>
              )}
              {locked === "custom" && (
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-200 text-sm">
                  <div className="font-semibold text-purple-800 mb-2">🔧 Кастомный микс зафиксирован</div>
                  <div className="space-y-1 text-gray-700">
                    {SCREENS.map(s => (
                      <div key={s}>{SCREEN_LABELS[s]}: <b className={VARIANTS[mix[s]].txt}>Вариант {mix[s]} ({VARIANTS[mix[s]].name})</b></div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => { setMode("variants"); setLocked(null); }}
                className="w-full border-2 border-gray-300 text-gray-700 font-semibold py-2 rounded-xl hover:bg-gray-50 transition text-sm">
                ← Вернуться к вариантам
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-400 space-y-1">
          <div>PulseOS · WHOOP Analogue CJM Prototype · DEEP Mode · 2026-04-15</div>
          <div>Generated by reverse-engineering-unicorn v2 · Module 2.5</div>
        </div>
      </div>
    </div>
  );
}
