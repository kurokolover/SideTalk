// словарь переводов и helper t()
export const translations = {
  ru: {
    tab_chat: "чат",
    tab_stories: "истории",
    submenu_my_chats: "мои чаты",
    submenu_chat: "чат",

    tagline: "Просто разговор. Просто сейчас.",
    anti_bullying: "анти-буллинг фильтр",
    anti_bullying_tooltip: "Фильтр автоматически блокирует оскорбительные и агрессивные сообщения для безопасного общения",
    geo_search: "поиск по геолокации",
    country_label: "страна",
    choose_country: "выбрать страну",
    filter_label: "фильтрация для поиска",

    my_age: "мой возраст",
    my_gender: "мой пол",
    peer_age: "возраст собеседника",
    peer_gender: "пол собеседника",

    age_18_25: "18–25",
    age_25_plus: "25+",
    any: "не важно",
    female: "женщина",
    male: "мужчина",

    relax_text: "Мы сами подберём тебе собеседника — просто начни чат.",
    start_chat: "начать чат",

    // searching
    searching_title: "ПОИСК СОБЕСЕДНИКА",
    searching_sub: "необходимо немного подождать...",
    searching_cancel: "отменить поиск",

    // chat
    chat_title: "анонимный собеседник",
    chat_online: "онлайн",
    chat_ended: "диалог завершен",
    chat_ended_hint: "Диалог завершен — новые сообщения отправлять нельзя.",
    chat_placeholder: "отправить сообщение...",
    chat_send: "отправить",
    chat_finish: "завершить",
    back: "назад",

    // after chat
    after_title: "Отличный разговор!",
    after_sub: "Диалог успешно завершен",
    after_go_home: "на главную",
    after_go_chats: "история чатов",
    after_go_stories: "лента историй",

    // my chats
    mychats_empty: "История чата пуста...",
    mychats_no_messages: "нет сообщений",
    mychats_open: "открыть",

    // stories
    stories_title: "анонимная лента историй",
    stories_placeholder: "поделитесь историей...",
    stories_publish: "опубликовать",
    stories_share: "поделиться историей",
    stories_empty: "Пока нет историй.",
    stories_comment: "комментарии",
    stories_send_comment: "отправить",
    time_minutes: "м",
    time_hours: "ч",
    time_days: "д",

    avatar_title: "Выберите аватар",
    country_title: "Выберите страну",
    modal_done: "готово",

    countries: [
      "Россия",
      "Беларусь",
      "Казахстан",
      "Грузия",
      "Армения",
      "Азербайджан",
      "Узбекистан",
      "Молдова",
      "Латвия",
      "Литва",
      "Эстония",
      "Польша",
      "Германия",
      "Франция",
      "Испания",
      "Италия",
      "Турция",
      "США",
      "Канада",
      "Великобритания",
    ],
  },
  en: {
    tab_chat: "chat",
    tab_stories: "stories",
    submenu_my_chats: "my chats",
    submenu_chat: "chat",

    tagline: "Just a conversation. Just now.",
    anti_bullying: "anti-bullying filter",
    anti_bullying_tooltip: "Filter automatically blocks offensive and aggressive messages for safe communication",
    geo_search: "location search",
    country_label: "country",
    choose_country: "choose country",
    filter_label: "search filters",

    my_age: "my age",
    my_gender: "my gender",
    peer_age: "partner age",
    peer_gender: "partner gender",

    age_18_25: "18–25",
    age_25_plus: "25+",
    any: "doesn’t matter",
    female: "female",
    male: "male",

    relax_text: "We’ll match you with someone — just start a chat.",
    start_chat: "start chat",

    // searching
    searching_title: "FINDING A PARTNER",
    searching_sub: "please wait a bit...",
    searching_cancel: "cancel",

    // chat
    chat_title: "anonymous partner",
    chat_online: "online",
    chat_ended: "chat ended",
    chat_ended_hint: "Chat ended — you can't send new messages.",
    chat_placeholder: "type a message...",
    chat_send: "send",
    chat_finish: "finish",
    back: "back",

    // after chat
    after_title: "Nice talk!",
    after_sub: "Chat has ended",
    after_go_home: "home",
    after_go_chats: "my chats",
    after_go_stories: "stories feed",

    // my chats
    mychats_empty: "Chat history is empty...",
    mychats_no_messages: "no messages",
    mychats_open: "open",

    // stories
    stories_title: "anonymous stories feed",
    stories_placeholder: "share your story...",
    stories_publish: "publish",
    stories_share: "share story",
    stories_empty: "No stories yet.",
    stories_comment: "comments",
    stories_send_comment: "send",
    time_minutes: "m",
    time_hours: "h",
    time_days: "d",

    avatar_title: "Choose an avatar",
    country_title: "Choose a country",
    modal_done: "done",

    countries: [
      "Russia",
      "Belarus",
      "Kazakhstan",
      "Georgia",
      "Armenia",
      "Azerbaijan",
      "Uzbekistan",
      "Moldova",
      "Latvia",
      "Lithuania",
      "Estonia",
      "Poland",
      "Germany",
      "France",
      "Spain",
      "Italy",
      "Turkey",
      "USA",
      "Canada",
      "United Kingdom",
    ],
  },
};

// файлы аватаров (из public)
export const avatarFiles = [
  { file: "/лиса.png", altRu: "Лиса", altEn: "Fox" },
  { file: "/медведь.png", altRu: "Медведь", altEn: "Bear" },
  { file: "/кот.png", altRu: "Кот", altEn: "Cat" },
  { file: "/собака.png", altRu: "Собака", altEn: "Dog" },
  { file: "/заяц.png", altRu: "Заяц", altEn: "Rabbit" },
  { file: "/свинка.png", altRu: "Свинка", altEn: "Pig" },
  { file: "/сова.png", altRu: "Сова", altEn: "Owl" },
  { file: "/обезьяна.png", altRu: "Обезьяна", altEn: "Monkey" },
];

export const tFactory = (language) => {
  const dict = translations[language] || translations.ru;
  return (key) => dict[key] ?? key;
};

// маппинг стран к флагам
export const countryFlags = {
  // русские названия
  "Россия": "/flags/russia.svg",
  "Беларусь": "/flags/belarus.svg",
  "Казахстан": "/flags/kazakhstan.svg",
  "Грузия": "/flags/georgia.svg",
  "Армения": "/flags/armenia.svg",
  "Азербайджан": "/flags/azerbaijan.svg",
  "Узбекистан": "/flags/uzbekistan.svg",
  "Молдова": "/flags/moldova.svg",
  "Латвия": "/flags/latvia.svg",
  "Литва": "/flags/lithuania.svg",
  "Эстония": "/flags/estonia.svg",
  "Польша": "/flags/poland.svg",
  "Германия": "/flags/germany.svg",
  "Франция": "/flags/france.svg",
  "Испания": "/flags/spain.svg",
  "Италия": "/flags/italy.svg",
  "Турция": "/flags/turkey.svg",
  "США": "/flags/usa.svg",
  "Канада": "/flags/canada.svg",
  "Великобритания": "/flags/uk.svg",

  // английские названия
  "Russia": "/flags/russia.svg",
  "Belarus": "/flags/belarus.svg",
  "Kazakhstan": "/flags/kazakhstan.svg",
  "Georgia": "/flags/georgia.svg",
  "Armenia": "/flags/armenia.svg",
  "Azerbaijan": "/flags/azerbaijan.svg",
  "Uzbekistan": "/flags/uzbekistan.svg",
  "Moldova": "/flags/moldova.svg",
  "Latvia": "/flags/latvia.svg",
  "Lithuania": "/flags/lithuania.svg",
  "Estonia": "/flags/estonia.svg",
  "Poland": "/flags/poland.svg",
  "Germany": "/flags/germany.svg",
  "France": "/flags/france.svg",
  "Spain": "/flags/spain.svg",
  "Italy": "/flags/italy.svg",
  "Turkey": "/flags/turkey.svg",
  "USA": "/flags/usa.svg",
  "Canada": "/flags/canada.svg",
  "United Kingdom": "/flags/uk.svg",
};
