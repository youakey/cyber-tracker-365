/* =========================================================================
   ЛИЧНЫЙ ПРОТОКОЛ :: шесть обязательных целей
   ========================================================================= */

export const MUSCLES = {
  chest:'Грудные', front_delt:'Передняя дельта', side_delt:'Средняя дельта',
  rear_delt:'Задняя дельта', triceps:'Трицепс', biceps:'Бицепс',
  forearm:'Предплечье', abs:'Пресс', obliques:'Косые',
  lats:'Широчайшие', traps:'Трапеция', lower_back:'Разгибатели спины',
  glutes:'Ягодичные', quads:'Квадрицепс', hamstrings:'Бицепс бедра',
  adductors:'Приводящие', calves:'Икроножные', hip_flexors:'Сгибатели бедра',
  serratus:'Зубчатые', neck:'Шея',
};

export const PROGRESSIONS = {
  planche:   ['tuck', 'adv_tuck', 'straddle', 'full'],
  handstand: ['wall', 'freestanding', 'freestyle', 'one_arm'],
  split:     ['90deg', '120deg', '150deg', 'full_180'],
};

/** Человеческие подписи для состояний прогрессии. */
export const PROGRESSION_RU = {
  tuck:'В группировке', adv_tuck:'Продвинутая группировка', straddle:'Ноги врозь', full:'Полный',
  wall:'У стены', freestanding:'Без опоры', freestyle:'Свободная', one_arm:'На одной руке',
  '90deg':'90°', '120deg':'120°', '150deg':'150°', full_180:'Полный 180°',
};

/** Six tracks. `metric` drives which input fields the log form renders. */
export const TRACKS = [
  /* ---------------- TRACK A :: CALISTHENICS & FLEXIBILITY ---------------- */
  {
    code:'split', track:'A', name:'Шпагат', en:'Full Split', glyph:'ШПГ',
    color:'var(--p-split)', kind:'mobility', metric:'angle',
    unit:'°', targetKey:'target_split_deg', defaultTarget:180,
    muscles:['hamstrings','adductors','hip_flexors','glutes'],
    fields:['angle_degrees','stretch_minutes'],
    blurb:'Раскрытие тазобедренного сустава. Записывайте минуты растяжки и измеренный угол.',
    progression:'split',
    node:{ x:18, y:20 },
  },
  {
    code:'planche', track:'A', name:'Горизонт', en:'Full Planche', glyph:'ГОР',
    color:'var(--p-planche)', kind:'calisthenics', metric:'hold',
    unit:'s', targetKey:'target_planche_sec', defaultTarget:15,
    muscles:['front_delt','chest','serratus','abs','biceps','lower_back'],
    fields:['hold_seconds','progression'],
    blurb:'Изометрия с наклоном вперёд. Прогрессия: группировка → продвинутая → ноги врозь → полный.',
    progression:'planche',
    node:{ x:50, y:14 },
  },
  {
    code:'handstand', track:'A', name:'Стойка на руках', en:'Handstand', glyph:'СТК',
    color:'var(--p-handstand)', kind:'calisthenics', metric:'hold',
    unit:'s', targetKey:'target_handstand_sec', defaultTarget:60,
    muscles:['side_delt','front_delt','traps','abs','forearm','triceps'],
    fields:['hold_seconds','progression'],
    blurb:'Баланс вниз головой. Записывайте время удержания и число попыток.',
    progression:'handstand',
    node:{ x:82, y:22 },
  },
  /* ---------------- TRACK B :: ABSOLUTE POWERLIFTING --------------------- */
  {
    code:'bench', track:'B', name:'Жим лёжа', en:'Bench Press', glyph:'ЖИМ',
    color:'var(--p-bench)', kind:'gym', metric:'load',
    unit:'kg', targetKey:'target_bench_kg', defaultTarget:100,
    muscles:['chest','front_delt','triceps','serratus'],
    fields:['weight_kg','reps','sets'],
    blurb:'Горизонтальный жим. Считается расчётный 1ПМ, рабочий вес и объём повторений.',
    node:{ x:22, y:62 },
  },
  {
    code:'squat', track:'B', name:'Присед', en:'Squat', glyph:'ПРС',
    color:'var(--p-squat)', kind:'gym', metric:'load',
    unit:'kg', targetKey:'target_squat_kg', defaultTarget:140,
    muscles:['quads','glutes','adductors','lower_back','abs','calves'],
    fields:['weight_kg','reps','sets'],
    blurb:'Двусторонняя нагрузка с акцентом на колено. Считается 1ПМ и тоннаж.',
    node:{ x:50, y:78 },
  },
  {
    code:'deadlift', track:'B', name:'Становая в сумо', en:'Sumo Deadlift', glyph:'СУМ',
    color:'var(--p-deadlift)', kind:'gym', metric:'load',
    unit:'kg', targetKey:'target_deadlift_kg', defaultTarget:180,
    muscles:['hamstrings','glutes','adductors','lower_back','traps','forearm','lats'],
    fields:['weight_kg','reps','sets'],
    blurb:'Тазовый шарнир в широкой стойке. Считается 1ПМ, целевой вес и повторения.',
    node:{ x:78, y:64 },
  },
];

export const TRACK_BY_CODE = Object.fromEntries(TRACKS.map(t => [t.code, t]));

/** Tapping a muscle zone on the hologram routes to this track. */
export const MUSCLE_TO_TRACK = {
  chest:'bench', front_delt:'planche', triceps:'bench', serratus:'planche',
  side_delt:'handstand', traps:'handstand', forearm:'handstand', neck:'handstand',
  abs:'planche', obliques:'planche', biceps:'planche',
  lats:'deadlift', rear_delt:'deadlift', lower_back:'deadlift',
  hamstrings:'deadlift', glutes:'squat', quads:'squat', calves:'squat',
  adductors:'split', hip_flexors:'split',
};

/* -------------------------------- BOSSES --------------------------------- */
export const BOSSES = [
  { code:'iron_sentinel', name:'Железный страж', hp:900, credits:600, track:'bench',
    unlock:{ metric:'est_1rm', track:'bench', at:0.6 },
    art:`   ╔═══════╗\n   ║ ▄▄ ▄▄ ║\n  ═╣  ███  ╠═\n   ║ ▀▀▀▀▀ ║\n   ╚═╦═══╦═╝\n     █   █` },
  { code:'gravity_wyrm', name:'Гравитационный змей', hp:1500, credits:1100, track:'squat',
    unlock:{ metric:'est_1rm', track:'squat', at:0.6 },
    art:`  ▄▄███████▄▄\n ██ ◣  ◢ ██\n ▀█▄ ▀▀▀▀ ▄█▀\n   ▀██████▀\n  ╱╲  ╱╲  ╱╲` },
  { code:'null_titan', name:'Нулевой титан', hp:2400, credits:2000, track:'deadlift',
    unlock:{ metric:'est_1rm', track:'deadlift', at:0.7 },
    art:` ┏━━━━━━━━━┓\n ┃ ▚▚▚▚▚▚▚ ┃\n ┃  ◈   ◈  ┃\n ┗━┳━━━━━┳━┛\n ▟█┛     ┗█▙` },
  { code:'static_seraph', name:'Статический серафим', hp:1800, credits:1500, track:'planche',
    unlock:{ metric:'hold_seconds', track:'planche', at:0.5 },
    art:`  ╲  ╱▔▔╲  ╱\n   ╲╱ ◉◉ ╲╱\n   ╱▏████▕╲\n  ╱ ╲▁▁▁▁╱ ╲` },
  { code:'axis_hydra', name:'Осевая гидра', hp:2000, credits:1700, track:'handstand',
    unlock:{ metric:'hold_seconds', track:'handstand', at:0.5 },
    art:` ◢◣   ◢◣   ◢◣\n ╲█╲ ╱█╱ ╲█╱\n   ╲█████╱\n    ▐███▌\n    ╱   ╲` },
  { code:'fracture_lord', name:'Владыка разлома', hp:1300, credits:900, track:'split',
    unlock:{ metric:'angle_degrees', track:'split', at:0.75 },
    art:`   ╱╲    ╱╲\n  ╱  ╲__╱  ╲\n ▕  ◉    ◉  ▏\n  ╲  ▁▁▁▁  ╱\n   ▔▔╱  ╲▔▔` },
];

/* ------------------------- ACHIEVEMENT DEFINITIONS ----------------------- */
export const ACHIEVEMENTS = [
  { code:'first_log',    title:'Система в сети',        tier:'bronze', exp:40,  test:s => s.logs.length >= 1 },
  { code:'week_quota',   title:'Норма недели выполнена',    tier:'silver', exp:120, test:s => s.weekSessions >= s.quota },
  { code:'streak_4',     title:'Четыре недели подряд',    tier:'gold',   exp:400, test:s => s.streak >= 4 },
  { code:'streak_12',    title:'Квартал дисциплины', tier:'plat',   exp:1200,test:s => s.streak >= 12 },
  { code:'bench_bw',     title:'Жим своего веса',     tier:'silver', exp:250, test:s => s.bw > 0 && s.pr.bench >= s.bw },
  { code:'squat_2bw',    title:'Присед в два своих веса', tier:'gold',exp:600, test:s => s.bw > 0 && s.pr.squat >= s.bw * 2 },
  { code:'dl_250',       title:'Становая 250 кг',      tier:'plat',   exp:900, test:s => s.pr.deadlift >= 250 },
  { code:'planche_full', title:'Горизонт взят',     tier:'plat',   exp:1500,test:s => s.pr.planche >= 15 },
  { code:'hs_60',        title:'Минута в стойке',   tier:'gold',   exp:700, test:s => s.pr.handstand >= 60 },
  { code:'split_180',    title:'Полный шпагат',  tier:'plat',   exp:1000,test:s => s.pr.split >= 180 },
  { code:'logs_50',      title:'50 записей', tier:'silver', exp:300, test:s => s.logs.length >= 50 },
  { code:'logs_250',     title:'Архивариус',            tier:'gold',   exp:900, test:s => s.logs.length >= 250 },
  { code:'sleep_first',  title:'Первая ночь в журнале', tier:'bronze', exp:40,  test:s => s.sleep.logged >= 1 },
  { code:'sleep_streak7',title:'Неделя подъёмов в 05:00',tier:'silver',exp:320, test:s => s.sleep.streak >= 7 },
  { code:'sleep_streak30',title:'Месяц режима',         tier:'gold',   exp:1100,test:s => s.sleep.streak >= 30 },
  { code:'sleep_rate80', title:'Стабильный режим',      tier:'silver', exp:260, test:s => s.sleep.rate14 >= 80 },
];

/* --------------------------- OFFLINE GEAR MIRROR ------------------------- */
export const GEAR_FALLBACK = [
  { code:'titanium_belt',  name:'Титановый атлетический пояс',  slot:'waist',  cost:1200, exp_multiplier:1.15, rarity:'rare',      glyph:'BELT', description:'Серво-натяжной поясничный бандаж. +15% опыта в приседе и становой.' },
  { code:'magnetic_wraps', name:'Магнитные кистевые фиксаторы',   slot:'wrist',  cost:850,  exp_multiplier:1.10, rarity:'uncommon',  glyph:'WRST', description:'Электромагнитные стабилизаторы. +10% опыта во всех жимах.' },
  { code:'carbon_grips',   name:'Углеродные нанонакладки',      slot:'hands',  cost:600,  exp_multiplier:1.08, rarity:'common',    glyph:'GRIP', description:'Графеновая решётка на ладони. +8% опыта, хват не подводит.' },
  { code:'spinal_rig',     name:'Экзо-каркас спины MK-II',   slot:'spine',  cost:2400, exp_multiplier:1.25, rarity:'epic',      glyph:'SPNE', description:'Экзоскелет задней цепи. +25% опыта за любую тренировку в зале.' },
  { code:'neural_link',    name:'Нейролинк концентрации',      slot:'neural', cost:3600, exp_multiplier:1.35, rarity:'legendary', glyph:'NRL',  description:'Разгон коры мозга. +35% опыта, урон по челленджам ×2.' },
  { code:'grav_boots',     name:'Ботинки инверсии тяжести',slot:'boots',  cost:1500, exp_multiplier:1.18, rarity:'rare',      glyph:'BOOT', description:'Инвертирующая подошва. +18% опыта в стойке и горизонте.' },
  { code:'hydraulic_hips', name:'Гидроприводы таза',slot:'waist',  cost:1800, exp_multiplier:1.20, rarity:'epic',      glyph:'HIPS', description:'Микроприводы тазобедренной капсулы. +20% опыта в шпагате и мобильности.' },
  { code:'coolant_sleeve', name:'Терморегулирующие рукава',   slot:'wrist',  cost:400,  exp_multiplier:1.05, rarity:'common',    glyph:'COOL', description:'Терморегулирующее плетение. +5% опыта, батарея садится медленнее.' },
];
