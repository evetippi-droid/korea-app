import * as Clipboard from "expo-clipboard";
import * as KeepAwake from "expo-keep-awake";
import * as Speech from "expo-speech";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

type KoreaKeelRow = {
  id: string;
  created_at: string | null;
  kr: string;
  et: string | null;
  roman: string | null;
  type: string | null;
  difficulty: string | null;
  category: string | null;
  subcategory: string | null;
  is_favorite: boolean | null;
};

type FormState = {
  kr: string;
  et: string;
  roman: string;
  type: string;
  difficulty: string;
  category: string;
  subcategory: string;
  is_favorite: boolean;
};

type UiLanguage = "et" | "ko";
type StudyDirection = "et-ko" | "ko-et";
type AutoMode = "off" | "et-ko" | "ko-et";

type VoiceInfo = {
  identifier?: string;
  language?: string;
  name?: string;
};

type CategoryConfig = {
  id: string;
  icon: string;
  label: {
    et: string;
    ko: string;
  };
  subcategories: Array<{
    id: string;
    label: {
      et: string;
      ko: string;
    };
  }>;
};

const DEFAULT_FORM: FormState = {
  kr: "",
  et: "",
  roman: "",
  type: "",
  difficulty: "",
  category: "",
  subcategory: "",
  is_favorite: false,
};

const DIFFICULTY_OPTIONS = ["ALL", "1", "2", "3"];

const APP_PREFS_KEY = "korea-app-learning-preferences-v1";

type SavedPreferences = {
  selectedCategory: string | null;
  selectedSubcategory: string;
  selectedDifficulty: string;
  favoritesOnly: boolean;
  shuffleMode: boolean;
  studyDirection: StudyDirection;
  romanizationVisible: boolean;
  currentWordId: string | null;
};


const CATEGORY_CONFIG: CategoryConfig[] = [
  {
    id: "Tähestik",
    icon: "🔤",
    label: { et: "Tähestik", ko: "알파벳" },
    subcategories: [
      { id: "tähed", label: { et: "Tähed", ko: "자모" } },
      { id: "silbid", label: { et: "Silbid", ko: "음절" } },
    ],
  },
  {
    id: "Igapäevaelu",
    icon: "🗣️",
    label: { et: "Igapäevaelu", ko: "일상생활" },
    subcategories: [
      { id: "Igapäevane", label: { et: "Igapäevane", ko: "일상 표현" } },
      { id: "Vestlus", label: { et: "Vestlus", ko: "회화" } },
      { id: "Küsimused", label: { et: "Küsimused", ko: "질문" } },
      { id: "Tegevused", label: { et: "Tegevused", ko: "활동" } },
      { id: "Aeg", label: { et: "Aeg", ko: "시간" } },
      { id: "Rutiin", label: { et: "Rutiin", ko: "루틴" } },
    ],
  },
  {
    id: "Suhted ja emotsioonid",
    icon: "❤️",
    label: { et: "Suhted ja emotsioonid", ko: "관계와 감정" },
    subcategories: [
      { id: "Suhted", label: { et: "Suhted", ko: "관계" } },
      { id: "Armastus", label: { et: "Armastus", ko: "사랑" } },
      { id: "Romantika", label: { et: "Romantika", ko: "로맨스" } },
      { id: "Emotsioonid", label: { et: "Emotsioonid", ko: "감정" } },
      { id: "Viisakus", label: { et: "Viisakus", ko: "예의" } },
      { id: "Vabandamine", label: { et: "Vabandamine", ko: "사과" } },
    ],
  },
  {
    id: "Perekond",
    icon: "👨‍👩‍👧",
    label: { et: "Perekond", ko: "가족" },
    subcategories: [
      { id: "Lähisugulased", label: { et: "Lähisugulased", ko: "가까운 가족" } },
      { id: "Sugulased", label: { et: "Sugulased", ko: "친척" } },
    ],
  },
  {
    id: "Inimene",
    icon: "🧍",
    label: { et: "Inimene", ko: "사람" },
    subcategories: [
      { id: "Pea", label: { et: "Pea", ko: "머리" } },
      { id: "Keha", label: { et: "Keha", ko: "몸" } },
      { id: "Üldine", label: { et: "Üldine", ko: "일반" } },
      { id: "Välimus", label: { et: "Välimus", ko: "외모" } },
    ],
  },
  {
    id: "Toit",
    icon: "🍜",
    label: { et: "Toit", ko: "음식" },
    subcategories: [
      { id: "Köögiviljad", label: { et: "Köögiviljad", ko: "채소" } },
      {
        id: "Puuviljad, marjad, tsitrused",
        label: { et: "Puuviljad, marjad, tsitrused", ko: "과일, 베리, 감귤류" },
      },
      { id: "Liha ja mereannid", label: { et: "Liha ja mereannid", ko: "고기와 해산물" } },
      { id: "Piim ja munad", label: { et: "Piim ja munad", ko: "유제품과 달걀" } },
      { id: "Saiatooted", label: { et: "Saiatooted", ko: "빵류" } },
      { id: "Kuivained, pähklid", label: { et: "Kuivained, pähklid", ko: "건식재료, 견과류" } },
      { id: "Õlid", label: { et: "Õlid", ko: "오일" } },
      { id: "Maitseained", label: { et: "Maitseained", ko: "양념" } },
      { id: "Konservtoidud", label: { et: "Konservtoidud", ko: "통조림 식품" } },
      { id: "Külmutatud", label: { et: "Külmutatud", ko: "냉동식품" } },
      { id: "Road", label: { et: "Road", ko: "요리" } },
      { id: "Valmistoit", label: { et: "Valmistoit", ko: "즉석식품" } },
      { id: "Maiustused ja snäkid", label: { et: "Maiustused ja snäkid", ko: "간식과 디저트" } },
      { id: "Joogid", label: { et: "Joogid", ko: "음료" } },
      { id: "Alkohol", label: { et: "Alkohol", ko: "술" } },
    ],
  },
  {
    id: "Liikumine ja kohad",
    icon: "🚗",
    label: { et: "Liikumine ja kohad", ko: "이동과 장소" },
    subcategories: [
      { id: "Transport", label: { et: "Transport", ko: "교통" } },
      { id: "Asukoht", label: { et: "Asukoht", ko: "위치" } },
      { id: "Suunad", label: { et: "Suunad", ko: "방향" } },
      { id: "Ostlemine", label: { et: "Ostlemine", ko: "쇼핑" } },
      { id: "Teenused / ilu", label: { et: "Teenused / ilu", ko: "서비스 / 뷰티" } },
      { id: "Restoranis", label: { et: "Restoranis", ko: "식당에서" } },
    ],
  },
  {
    id: "Reisimine",
    icon: "✈️",
    label: { et: "Reisimine", ko: "여행" },
    subcategories: [
      { id: "Lennujaam", label: { et: "Lennujaam", ko: "공항" } },
      { id: "Hotell", label: { et: "Hotell", ko: "호텔" } },
      { id: "Piletid", label: { et: "Piletid", ko: "티켓" } },
      { id: "Turism", label: { et: "Turism", ko: "관광" } },
    ],
  },
  {
    id: "Tervis",
    icon: "🩺",
    label: { et: "Tervis", ko: "건강" },
    subcategories: [
      { id: "Sümptomid", label: { et: "Sümptomid", ko: "증상" } },
      { id: "Arst", label: { et: "Arst", ko: "의사" } },
      { id: "Haigused", label: { et: "Haigused", ko: "질병" } },
      { id: "Apteek", label: { et: "Apteek", ko: "약국" } },
    ],
  },
  {
    id: "Töö ja kool",
    icon: "🎓",
    label: { et: "Töö ja kool", ko: "직장과 학교" },
    subcategories: [
      { id: "Töö", label: { et: "Töö", ko: "직장" } },
      { id: "Kool", label: { et: "Kool", ko: "학교" } },
    ],
  },
  {
    id: "Raha",
    icon: "💰",
    label: { et: "Raha", ko: "돈" },
    subcategories: [
      { id: "Raha", label: { et: "Raha", ko: "돈" } },
      { id: "Maksmine", label: { et: "Maksmine", ko: "결제" } },
      { id: "Hinnad", label: { et: "Hinnad", ko: "가격" } },
      { id: "Pank", label: { et: "Pank", ko: "은행" } },
    ],
  },
  {
    id: "Tehnoloogia",
    icon: "🌐",
    label: { et: "Tehnoloogia", ko: "기술" },
    subcategories: [
      { id: "Telefon", label: { et: "Telefon", ko: "전화" } },
      { id: "Arvuti", label: { et: "Arvuti", ko: "컴퓨터" } },
      { id: "Internet", label: { et: "Internet", ko: "인터넷" } },
      { id: "Äpid", label: { et: "Äpid", ko: "앱" } },
    ],
  },
  {
    id: "Esemed ja asjad",
    icon: "📦",
    label: { et: "Esemed ja asjad", ko: "물건과 소지품" },
    subcategories: [
      { id: "Koduesemed", label: { et: "Koduesemed", ko: "생활용품" } },
      { id: "Riided", label: { et: "Riided", ko: "옷" } },
      { id: "Ehted", label: { et: "Ehted", ko: "장신구" } },
      { id: "Isiklikud esemed", label: { et: "Isiklikud esemed", ko: "개인 소지품" } },
    ],
  },
  {
    id: "Meelelahutus",
    icon: "🎬",
    label: { et: "Meelelahutus", ko: "엔터테인먼트" },
    subcategories: [
      { id: "Kdrama", label: { et: "K-drama", ko: "한국 드라마" } },
      { id: "Kino", label: { et: "Kino", ko: "영화관" } },
      { id: "Teater", label: { et: "Teater", ko: "극장" } },
      { id: "Kontsert", label: { et: "Kontsert", ko: "콘서트" } },
    ],
  },
  {
  id: "ajavormid",
  icon: "🕒",
  label: { et: "Ajavormid", ko: "시제와 시간" },
  subcategories: [
    { id: "kuud", label: { et: "Kuud", ko: "월" } },
    { id: "päevad", label: { et: "Päevad", ko: "요일" } },
    { id: "kellaaeg", label: { et: "Kellaaeg", ko: "시간 표현" } },
    { id: "üldine", label: { et: "Üldine", ko: "일반" } },
  ],
},
  {
    id: "Keelevormid",
    icon: "🗨️",
    label: { et: "Keelevormid", ko: "문법과 표현" },
    subcategories: [
      { id: "Tegusõnad", label: { et: "Tegusõnad", ko: "동사" } },
      { id: "Määrsõna", label: { et: "Määrsõna", ko: "부사" } },
      { id: "Omadussõnad", label: { et: "Omadussõnad", ko: "형용사" } },
      { id: "Nimisõnad", label: { et: "Nimisõnad", ko: "명사" } },
      { id: "Lauseehitus", label: { et: "Lauseehitus", ko: "문장 구조" } },
      { id: "Släng", label: { et: "Släng", ko: "속어" } },
      { id: "Numbrid", label: { et: "Numbrid", ko: "숫자" } },
    ],
  },
];

const UI_TEXT = {
  et: {
    title: "🇰🇷 Korea sõnad",
    subtitle: "Vali põhikategooria, siis alamkategooria ja õpi kohe sõnavara.",
    allSubcategories: "Kõik alamkategooriad",
    categories: "Põhikategooriad",
    subcategories: "Alamkategooriad",
    level: "Raskusaste",
    quickActions: "Kiirvalikud",
    wordList: "Sõnade nimekiri",
    addWord: "+ Lisa sõna",
    newWord: "Lisa sõna",
    editWord: "Muuda sõna",
    cancel: "Tühista",
    save: "Salvesta",
    loading: "Laen...",
    emptyCategory: "Vali põhikategooria, et näha sõnavara.",
    emptyWords: "Selle valikuga sõnu ei leitud.",
    favoritesOnly: "Ainult favoriidid",
    allWords: "Kõik sõnad",
    shuffleOn: "Shuffle sees",
    shuffleOff: "Shuffle väljas",
    selected: "Valitud",
    total: "Kokku",
    filtered: "Filtreeritud",
    etToKo: "ET → KO",
    koToEt: "KO → ET",
    autoEtKo: "Auto ET→KO",
    stopAutoEtKo: "Peata auto ET→KO",
    autoKoEt: "Auto KO→ET",
    stopAutoKoEt: "Peata auto KO→ET",
    prev: "← Eelmine",
    next: "Järgmine →",
    random: "Juhuslik",
    difficulty: "Raskus",
    type: "Tüüp",
    category: "Kategooria",
    subcategory: "Alamkategooria",
    favorite: "Favoriit ✓",
    notFavorite: "Mitte favoriit",
    missingInfo: "Puudub info",
    fillKrEt: "Palun sisesta vähemalt KR ja ET.",
    error: "Viga",
    copied: "Copied ✓",
    copyFailed: "Kopeerimine ebaõnnestus",
    listen: "Kuula",
    stopAuto: "Peata Auto",
    searchPlaceholder: "🔎 Otsi sõna...",
    studyDirectionLabel: "Õppesuund",
    directionEtKoHint: "1× eesti → 3× korea",
    directionKoEtHint: "1× korea → 3× eesti",
    romanization: "Romaniseerimine",
    romanizationOn: "SEES",
    romanizationOff: "VÄLJAS",
    searchAllWords: "Kõigist sõnadest",
    activeFilters: "Aktiivsed filtrid",
    clearAll: "Tühista kõik valikud",
    autoRunning: "AUTO töötab",
    continuePrevious: "Jätkad eelmisest korrast",
  },
  ko: {
    title: "🇰🇷 한국어 단어",
    subtitle: "대분류를 고르고, 하위 분류를 고른 뒤 바로 단어를 학습하세요.",
    allSubcategories: "전체 하위 카테고리",
    categories: "대분류",
    subcategories: "하위 카테고리",
    level: "난이도",
    quickActions: "빠른 설정",
    wordList: "단어 목록",
    addWord: "+ 단어 추가",
    newWord: "단어 추가",
    editWord: "단어 수정",
    cancel: "취소",
    save: "저장",
    loading: "불러오는 중...",
    emptyCategory: "단어를 보려면 대분류를 선택하세요.",
    emptyWords: "이 선택에는 단어가 없습니다.",
    favoritesOnly: "즐겨찾기만",
    allWords: "전체 단어",
    shuffleOn: "셔플 켜짐",
    shuffleOff: "셔플 꺼짐",
    selected: "선택됨",
    total: "전체",
    filtered: "필터 결과",
    etToKo: "ET → KO",
    koToEt: "KO → ET",
    autoEtKo: "자동 ET→KO",
    stopAutoEtKo: "자동 ET→KO 중지",
    autoKoEt: "자동 KO→ET",
    stopAutoKoEt: "자동 KO→ET 중지",
    prev: "← 이전",
    next: "다음 →",
    random: "랜덤",
    difficulty: "난이도",
    type: "품사",
    category: "카테고리",
    subcategory: "하위 카테고리",
    favorite: "즐겨찾기 ✓",
    notFavorite: "즐겨찾기 아님",
    missingInfo: "정보 부족",
    fillKrEt: "KR와 ET를 최소한 입력해 주세요.",
    error: "오류",
    copied: "Copied ✓",
    copyFailed: "복사 실패",
    listen: "듣기",
    stopAuto: "자동 중지",
    searchPlaceholder: "🔎 단어 검색...",
    studyDirectionLabel: "학습 방향",
    directionEtKoHint: "에스토니아어 1× → 한국어 3×",
    directionKoEtHint: "한국어 1× → 에스토니아어 3×",
    romanization: "로마자 표기",
    romanizationOn: "켜짐",
    romanizationOff: "꺼짐",
    searchAllWords: "전체 단어",
    activeFilters: "활성 필터",
    clearAll: "모든 선택 지우기",
    autoRunning: "AUTO 실행 중",
    continuePrevious: "이전 학습 계속",
  },
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeKey = (value: string | null | undefined) =>
  (value || "").trim().toLowerCase();

// Tähestiku erihääldus: ekraanil jääb jamo märk, kõnesünteesile anname
// loomulikult hääldatava korea kuju.
const HANGUL_PRONUNCIATION_MAP: Record<string, string> = {
  // Konsonantide ametlikud nimed
  "ㄱ": "기역",
  "ㄴ": "니은",
  "ㄷ": "디귿",
  "ㄹ": "리을",
  "ㅁ": "미음",
  "ㅂ": "비읍",
  "ㅅ": "시옷",
  "ㅇ": "이응",
  "ㅈ": "지읒",
  "ㅊ": "치읓",
  "ㅋ": "키읔",
  "ㅌ": "티읕",
  "ㅍ": "피읖",
  "ㅎ": "히읗",

  // Vokaalid – hääldamiseks kasutame silpi, mitte üksikut jamo märki
  "ㅏ": "아",
  "ㅑ": "야",
  "ㅓ": "어",
  "ㅕ": "여",
  "ㅗ": "오",
  "ㅛ": "요",
  "ㅜ": "우",
  "ㅠ": "유",
  "ㅡ": "으",
  "ㅣ": "이",
};

const getKoreanSpeechText = (word: KoreaKeelRow) => {
  if (normalizeKey(word.category) === normalizeKey("Tähestik")) {
    return HANGUL_PRONUNCIATION_MAP[word.kr] || word.kr;
  }

  return word.kr;
};

const getPreferredVoice = (
  voices: VoiceInfo[],
  languagePrefix: "et" | "ko",
  preferredNames: string[]
) => {
  const filtered = voices.filter((voice) =>
    voice.language?.toLowerCase().startsWith(languagePrefix)
  );

  for (const preferredName of preferredNames) {
    const found = filtered.find((voice) =>
      voice.name?.toLowerCase().includes(preferredName.toLowerCase())
    );
    if (found?.identifier) return found.identifier;
  }

  return filtered[0]?.identifier ?? null;
};

const getTypeLabel = (value: string | null | undefined, uiLanguage: UiLanguage) => {
  if (!value) return "-";

  const key = normalizeKey(value);
  const map: Record<string, { et: string; ko: string }> = {
    noun: { et: "Nimisõna", ko: "명사" },
    verb: { et: "Tegusõna", ko: "동사" },
    adjective: { et: "Omadussõna", ko: "형용사" },
    adverb: { et: "Määrsõna", ko: "부사" },
    phrase: { et: "Fraas", ko: "구" },
    question: { et: "Küsimus", ko: "질문" },
    nimisõna: { et: "Nimisõna", ko: "명사" },
    tegusõna: { et: "Tegusõna", ko: "동사" },
    omadussõna: { et: "Omadussõna", ko: "형용사" },
    määrsõna: { et: "Määrsõna", ko: "부사" },
    silp: { et: "Silp", ko: "음절" },
    täht: { et: "Täht", ko: "글자" },
    sõna: { et: "Sõna", ko: "단어" },
  };

  return map[key]?.[uiLanguage] || value;
};

export default function Index() {
  const [koreaKeel, setKoreaKeel] = useState<KoreaKeelRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [uiLanguage, setUiLanguage] = useState<UiLanguage>("et");
  const [studyDirection, setStudyDirection] = useState<StudyDirection>("et-ko");
  const [autoMode, setAutoMode] = useState<AutoMode>("off");

  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState("ALL");
  const [romanizationVisible, setRomanizationVisible] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [copiedWordId, setCopiedWordId] = useState<string | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [positionRestored, setPositionRestored] = useState(false);
  const [savedWordId, setSavedWordId] = useState<string | null>(null);
  const [resumeNoticeVisible, setResumeNoticeVisible] = useState(false);

  const [etVoiceId, setEtVoiceId] = useState<string | null>(null);
  const [koVoiceId, setKoVoiceId] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const autoModeRef = useRef<AutoMode>("off");
  const isAutoRunningRef = useRef(false);

  const t = UI_TEXT[uiLanguage];

  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryConfig>();
    CATEGORY_CONFIG.forEach((category) => {
      map.set(normalizeKey(category.id), category);
    });
    return map;
  }, []);

  const subcategoryLabelMap = useMemo(() => {
    const map = new Map<string, { et: string; ko: string }>();

    CATEGORY_CONFIG.forEach((category) => {
      category.subcategories.forEach((subcategory) => {
        map.set(normalizeKey(subcategory.id), subcategory.label);
      });
    });

    return map;
  }, []);

  const activeCategoryConfig = useMemo(() => {
    if (!selectedCategory) return null;
    return categoryMap.get(normalizeKey(selectedCategory)) || null;
  }, [categoryMap, selectedCategory]);

  const filteredWords = useMemo(() => {
    const searchQuery = normalizeKey(searchText);

    if (searchQuery) {
      return koreaKeel.filter((item) =>
        [item.kr, item.roman, item.et].some((value) =>
          normalizeKey(value).includes(searchQuery)
        )
      );
    }

    let result = [...koreaKeel];

    if (favoritesOnly) {
      result = result.filter((item) => !!item.is_favorite);
    }

    if (selectedDifficulty !== "ALL") {
      result = result.filter(
        (item) => String(item.difficulty ?? "") === selectedDifficulty
      );
    }

    if (selectedCategory) {
      result = result.filter(
        (item) =>
          normalizeKey(item.category) === normalizeKey(selectedCategory)
      );
    }

    if (selectedSubcategory !== "ALL") {
      result = result.filter(
        (item) =>
          normalizeKey(item.subcategory) === normalizeKey(selectedSubcategory)
      );
    }

    return result;
  }, [
    favoritesOnly,
    koreaKeel,
    searchText,
    selectedCategory,
    selectedDifficulty,
    selectedSubcategory,
  ]);

  const currentWord = filteredWords[currentIndex] || null;

  const translateCategory = (value: string | null | undefined) => {
    if (!value) return "-";
    const match = categoryMap.get(normalizeKey(value));
    return match?.label[uiLanguage] || value;
  };

  const translateSubcategory = (value: string | null | undefined) => {
    if (!value) return "-";
    const match = subcategoryLabelMap.get(normalizeKey(value));
    return match?.[uiLanguage] || value;
  };

  const loadWords = async () => {
    setLoading(true);

    try {
      const allWords: KoreaKeelRow[] = [];
      const pageSize = 1000;
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from("korea_keel")
          .select(
            "id, created_at, kr, et, roman, type, difficulty, category, subcategory, is_favorite"
          )
          .order("created_at", { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) {
          Alert.alert(UI_TEXT.et.error, error.message);
          return;
        }

        const rows = (data || []) as KoreaKeelRow[];
        allWords.push(...rows);

        if (rows.length < pageSize) {
          break;
        }

        from += pageSize;
      }

      setKoreaKeel(allWords);
    } catch (error) {
      console.log("Word loading error:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadVoices = async () => {
    try {
      const voices = (await Speech.getAvailableVoicesAsync()) as VoiceInfo[];

      const preferredEt = getPreferredVoice(voices, "et", ["anu", "female", "na"]);
      const preferredKo = getPreferredVoice(voices, "ko", ["hyunsu", "male", "nam"]);

      setEtVoiceId(preferredEt);
      setKoVoiceId(preferredKo);
    } catch (error) {
      console.log("Voice loading error:", error);
    }
  };

  const getVoiceForLanguage = (language: string) => {
    if (language === "et-EE") return etVoiceId || undefined;
    if (language === "ko-KR") return koVoiceId || undefined;
    return undefined;
  };

  const stopSpeech = async () => {
    Speech.stop();
    await wait(120);
  };

  const speakOnce = (
    text: string,
    language: string,
    rate = 0.9
  ): Promise<void> => {
    return new Promise((resolve) => {
      if (!text?.trim()) {
        resolve();
        return;
      }

      Speech.speak(text, {
        language,
        rate,
        voice: getVoiceForLanguage(language),
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    });
  };

  const speakEtKoSequence = async (word: KoreaKeelRow) => {
    await stopSpeech();

    const etText = word.et || word.roman || "";
    const koText = getKoreanSpeechText(word);

    // ET → KO: 1x eesti/romaniseeritud vaste + 3x korea
    await speakOnce(etText, "et-EE", 0.88);
    await wait(450);

    await speakOnce(koText, "ko-KR", 0.38);
    await wait(320);
    await speakOnce(koText, "ko-KR", 0.38);
    await wait(320);
    await speakOnce(koText, "ko-KR", 0.82);
  };

  const speakKoEtSequence = async (word: KoreaKeelRow) => {
    await stopSpeech();

    const etText = word.et || word.roman || "";
    const koText = getKoreanSpeechText(word);

    // KO → ET: 1x korea + 3x eesti/romaniseeritud vaste
    await speakOnce(koText, "ko-KR", 0.82);
    await wait(450);

    await speakOnce(etText, "et-EE", 0.38);
    await wait(320);
    await speakOnce(etText, "et-EE", 0.38);
    await wait(320);
    await speakOnce(etText, "et-EE", 0.82);
  };

  const speakSelectedDirection = async (word: KoreaKeelRow) => {
    if (studyDirection === "et-ko") {
      await speakEtKoSequence(word);
    } else {
      await speakKoEtSequence(word);
    }
  };

  const changeStudyDirection = (direction: StudyDirection) => {
    setStudyDirection(direction);
    setUiLanguage(direction === "et-ko" ? "et" : "ko");

    if (autoMode !== "off") {
      setAutoMode(direction);
    }
  };

  const toggleAuto = () => {
    setAutoMode((prev) => (prev === "off" ? studyDirection : "off"));
  };

  const clearAllSelections = () => {
    setSelectedCategory(null);
    setSelectedSubcategory("ALL");
    setSelectedDifficulty("ALL");
    setFavoritesOnly(false);
    setShuffleMode(false);
    setSearchText("");
    setCurrentIndex(0);
    setAutoMode("off");
  };

  const removeCategoryFilter = () => {
    setSelectedCategory(null);
    setSelectedSubcategory("ALL");
    setCurrentIndex(0);
  };

  const removeSubcategoryFilter = () => {
    setSelectedSubcategory("ALL");
    setCurrentIndex(0);
  };

  const removeDifficultyFilter = () => {
    setSelectedDifficulty("ALL");
    setCurrentIndex(0);
  };

  const removeFavoritesFilter = () => {
    setFavoritesOnly(false);
    setCurrentIndex(0);
  };

  const copyWordCard = async (item: KoreaKeelRow) => {
    try {
      const textToCopy = [item.kr, item.roman, item.et]
        .filter((value) => !!value && String(value).trim().length > 0)
        .join("\n");

      await Clipboard.setStringAsync(textToCopy);
      setCopiedWordId(item.id);

      setTimeout(() => {
        setCopiedWordId((current) => (current === item.id ? null : current));
      }, 1400);
    } catch {
      Alert.alert(t.error, t.copyFailed);
    }
  };

  const moveIndex = (direction: "next" | "prev" | "random") => {
    if (!filteredWords.length) return;

    if (direction === "random") {
      setCurrentIndex(Math.floor(Math.random() * filteredWords.length));
      return;
    }

    setCurrentIndex((prev) => {
      if (direction === "next") {
        return prev + 1 >= filteredWords.length ? 0 : prev + 1;
      }
      return prev - 1 < 0 ? filteredWords.length - 1 : prev - 1;
    });
  };

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setEditingWordId(null);
  };

  const updateForm = (key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: KoreaKeelRow) => {
    setEditingWordId(item.id);
    setForm({
      kr: item.kr || "",
      et: item.et || "",
      roman: item.roman || "",
      type: item.type || "",
      difficulty: item.difficulty || "",
      category: item.category || "",
      subcategory: item.subcategory || "",
      is_favorite: !!item.is_favorite,
    });
    setModalVisible(true);
  };

  const saveWord = async () => {
    if (!form.kr.trim() || !form.et.trim()) {
      Alert.alert(t.missingInfo, t.fillKrEt);
      return;
    }

    const payload = {
      kr: form.kr.trim(),
      et: form.et.trim(),
      roman: form.roman.trim() || null,
      type: form.type.trim() || null,
      difficulty: form.difficulty.trim() || null,
      category: form.category.trim() || null,
      subcategory: form.subcategory.trim() || null,
      is_favorite: form.is_favorite,
    };

    const query = editingWordId
      ? supabase.from("korea_keel").update(payload).eq("id", editingWordId)
      : supabase.from("korea_keel").insert([payload]);

    const { error } = await query;

    if (error) {
      Alert.alert(t.error, error.message);
      return;
    }

    setModalVisible(false);
    resetForm();
    loadWords();
  };

  const toggleFavorite = async (item: KoreaKeelRow) => {
    const nextValue = !item.is_favorite;

    const { error } = await supabase
      .from("korea_keel")
      .update({ is_favorite: nextValue })
      .eq("id", item.id);

    if (error) {
      Alert.alert(t.error, error.message);
      return;
    }

    setKoreaKeel((prev) =>
      prev.map((word) =>
        word.id === item.id ? { ...word, is_favorite: nextValue } : word
      )
    );
  };

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(APP_PREFS_KEY);

        if (raw) {
          const saved = JSON.parse(raw) as Partial<SavedPreferences>;

          if (saved.selectedCategory !== undefined) {
            setSelectedCategory(saved.selectedCategory ?? null);
          }
          if (saved.selectedSubcategory) {
            setSelectedSubcategory(saved.selectedSubcategory);
          }
          if (saved.selectedDifficulty) {
            setSelectedDifficulty(saved.selectedDifficulty);
          }
          if (typeof saved.favoritesOnly === "boolean") {
            setFavoritesOnly(saved.favoritesOnly);
          }
          if (typeof saved.shuffleMode === "boolean") {
            setShuffleMode(saved.shuffleMode);
          }
          if (saved.studyDirection === "et-ko" || saved.studyDirection === "ko-et") {
            setStudyDirection(saved.studyDirection);
            setUiLanguage(saved.studyDirection === "et-ko" ? "et" : "ko");
          }
          if (typeof saved.romanizationVisible === "boolean") {
            setRomanizationVisible(saved.romanizationVisible);
          }

          if (saved.currentWordId) {
            setSavedWordId(saved.currentWordId);
          } else {
            setPositionRestored(true);
          }

          setResumeNoticeVisible(true);
        } else {
          setPositionRestored(true);
        }
      } else {
        setPositionRestored(true);
      }
    } catch (error) {
      console.log("Preference loading error:", error);
      setPositionRestored(true);
    } finally {
      setPreferencesLoaded(true);
    }

    loadWords();
    loadVoices();
  }, []);

  useEffect(() => {
    autoModeRef.current = autoMode;
  }, [autoMode]);

  useEffect(() => {
    const keepAwakeTag = "korea-auto-mode";

    const updateKeepAwake = async () => {
      try {
        if (autoMode !== "off") {
          await KeepAwake.activateKeepAwakeAsync(keepAwakeTag);
        } else {
          await KeepAwake.deactivateKeepAwake(keepAwakeTag);
        }
      } catch (error) {
        console.log("Keep awake error:", error);
      }
    };

    updateKeepAwake();

    return () => {
      KeepAwake.deactivateKeepAwake(keepAwakeTag).catch(() => {});
    };
  }, [autoMode]);

  useEffect(() => {
    if (positionRestored) {
      setCurrentIndex(0);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (positionRestored) {
      setCurrentIndex(0);
    }
  }, [selectedSubcategory, selectedDifficulty, favoritesOnly]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [searchText]);

  useEffect(() => {
    if (filteredWords.length === 0) {
      setCurrentIndex(0);
      return;
    }

    if (currentIndex >= filteredWords.length) {
      setCurrentIndex(0);
    }
  }, [filteredWords.length, currentIndex]);

  useEffect(() => {
    if (!preferencesLoaded || positionRestored || !koreaKeel.length) return;

    if (!savedWordId) {
      setPositionRestored(true);
      return;
    }

    const restoredIndex = filteredWords.findIndex((word) => word.id === savedWordId);
    setCurrentIndex(restoredIndex >= 0 ? restoredIndex : 0);
    setPositionRestored(true);
    setSavedWordId(null);
  }, [
    preferencesLoaded,
    positionRestored,
    savedWordId,
    koreaKeel.length,
    filteredWords,
  ]);

  useEffect(() => {
    if (!preferencesLoaded || !positionRestored) return;
    if (typeof window === "undefined") return;

    const preferences: SavedPreferences = {
      selectedCategory,
      selectedSubcategory,
      selectedDifficulty,
      favoritesOnly,
      shuffleMode,
      studyDirection,
      romanizationVisible,
      currentWordId: currentWord?.id ?? null,
    };

    try {
      window.localStorage.setItem(APP_PREFS_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.log("Preference saving error:", error);
    }
  }, [
    preferencesLoaded,
    positionRestored,
    selectedCategory,
    selectedSubcategory,
    selectedDifficulty,
    favoritesOnly,
    shuffleMode,
    studyDirection,
    romanizationVisible,
    currentWord?.id,
  ]);

  useEffect(() => {
    if (!resumeNoticeVisible || !positionRestored) return;

    const timer = setTimeout(() => {
      setResumeNoticeVisible(false);
    }, 2800);

    return () => clearTimeout(timer);
  }, [resumeNoticeVisible, positionRestored]);

  useEffect(() => {
    if (autoMode === "off" || !filteredWords.length) {
      isAutoRunningRef.current = false;
      return;
    }

    if (isAutoRunningRef.current) return;
    isAutoRunningRef.current = true;

    let cancelled = false;

    const runAuto = async () => {
      while (!cancelled && autoModeRef.current !== "off") {
        const word = filteredWords[currentIndex];

        if (!word) {
          await wait(300);
          continue;
        }

        if (autoModeRef.current === "et-ko") {
          await speakEtKoSequence(word);
        } else if (autoModeRef.current === "ko-et") {
          await speakKoEtSequence(word);
        }

        await wait(900);

        if (cancelled) break;

        setCurrentIndex((prev) =>
          prev + 1 >= filteredWords.length ? 0 : prev + 1
        );

        await wait(120);
      }

      isAutoRunningRef.current = false;
    };

    runAuto();

    return () => {
      cancelled = true;
      isAutoRunningRef.current = false;
      Speech.stop();
    };
  }, [autoMode, currentIndex, filteredWords]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>{t.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={filteredWords}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.container}>
            <View style={styles.headerRow}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.title}>{t.title}</Text>
                <Text style={styles.subtitle}>{t.subtitle}</Text>
              </View>

              <View style={styles.studyDirectionWrap}>
                <Text style={styles.studyDirectionLabel}>
                  {t.studyDirectionLabel}
                </Text>

                <View style={styles.langToggle}>
                  <Pressable
                    onPress={() => changeStudyDirection("et-ko")}
                    style={[
                      styles.langToggleButton,
                      studyDirection === "et-ko" && styles.langToggleButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.langToggleText,
                        studyDirection === "et-ko" && styles.langToggleTextActive,
                      ]}
                    >
                      ET→KO
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => changeStudyDirection("ko-et")}
                    style={[
                      styles.langToggleButton,
                      studyDirection === "ko-et" && styles.langToggleButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.langToggleText,
                        studyDirection === "ko-et" && styles.langToggleTextActive,
                      ]}
                    >
                      KO→ET
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.directionHint}>
                  {studyDirection === "et-ko"
                    ? t.directionEtKoHint
                    : t.directionKoEtHint}
                </Text>

                <Pressable
                  style={[
                    styles.romanizationToggle,
                    romanizationVisible && styles.romanizationToggleActive,
                  ]}
                  onPress={() => setRomanizationVisible((prev) => !prev)}
                >
                  <Text
                    style={[
                      styles.romanizationToggleText,
                      romanizationVisible && styles.romanizationToggleTextActive,
                    ]}
                  >
                    {t.romanization}:{" "}
                    {romanizationVisible ? t.romanizationOn : t.romanizationOff}
                  </Text>
                </Pressable>
              </View>
            </View>

            {resumeNoticeVisible && positionRestored && (
              <View style={styles.resumeNotice}>
                <Text style={styles.resumeNoticeText}>
                  {t.continuePrevious}
                  {selectedCategory
                    ? ` · ${translateCategory(selectedCategory)}`
                    : ""}
                  {filteredWords.length
                    ? ` · ${currentIndex + 1} / ${filteredWords.length}`
                    : ""}
                </Text>
              </View>
            )}

            <View style={styles.topActions}>
              <View style={styles.searchSectionNearAdd}>
                <View style={styles.searchRow}>
                  <View style={styles.searchFieldWrap}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder={t.searchPlaceholder}
                      placeholderTextColor="#6B7280"
                      value={searchText}
                      onChangeText={setSearchText}
                      autoCorrect={false}
                      autoCapitalize="none"
                    />
                    <View style={styles.searchScopeBadge}>
                      <Text style={styles.searchScopeText}>
                        {t.searchAllWords}
                      </Text>
                    </View>
                  </View>

                  {!!searchText.trim() && (
                    <Pressable
                      style={styles.clearSearchButton}
                      onPress={() => setSearchText("")}
                    >
                      <Text style={styles.clearSearchButtonText}>✕</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              <Pressable style={styles.addButton} onPress={openAddModal}>
                <Text style={styles.addButtonText}>{t.addWord}</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>{t.categories}</Text>
            <View style={styles.categoryGrid}>
              {CATEGORY_CONFIG.map((category) => {
                const isActive =
                  normalizeKey(selectedCategory) === normalizeKey(category.id);

                return (
                  <Pressable
                    key={category.id}
                    style={[
                      styles.categoryCard,
                      isActive && styles.categoryCardActive,
                    ]}
                    onPress={() => {
                      const willClear =
                        normalizeKey(selectedCategory) === normalizeKey(category.id);

                      setSelectedCategory(willClear ? null : category.id);
                      setSelectedSubcategory("ALL");
                      setCurrentIndex(0);
                    }}
                  >
                    <Text style={styles.categoryIcon}>{category.icon}</Text>
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.categoryTitle,
                        isActive && styles.categoryTitleActive,
                      ]}
                    >
                      {category.label[uiLanguage]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {!!activeCategoryConfig && (
              <>
                <Text style={styles.sectionTitle}>{t.subcategories}</Text>

                <View style={styles.subcategoryWrap}>
                  <PillButton
                    label={t.allSubcategories}
                    active={selectedSubcategory === "ALL"}
                    onPress={() => setSelectedSubcategory("ALL")}
                  />

                  {activeCategoryConfig.subcategories.map((subcategory) => (
                    <PillButton
                      key={subcategory.id}
                      label={subcategory.label[uiLanguage]}
                      active={
                        normalizeKey(selectedSubcategory) ===
                        normalizeKey(subcategory.id)
                      }
                      onPress={() =>
                        setSelectedSubcategory((prev) =>
                          normalizeKey(prev) === normalizeKey(subcategory.id)
                            ? "ALL"
                            : subcategory.id
                        )
                      }
                    />
                  ))}
                </View>
              </>
            )}

            <Text style={styles.sectionTitle}>{t.level}</Text>
            <View style={styles.controlsWrap}>
              {DIFFICULTY_OPTIONS.map((level) => (
                <PillButton
                  key={level}
                  label={level === "ALL" ? "ALL" : `Level ${level}`}
                  active={selectedDifficulty === level}
                  onPress={() =>
                    setSelectedDifficulty((prev) =>
                      prev === level && level !== "ALL" ? "ALL" : level
                    )
                  }
                />
              ))}
            </View>

            <Text style={styles.sectionTitle}>{t.quickActions}</Text>
            <View style={styles.controlsWrap}>
              <PillButton
                label={favoritesOnly ? t.favoritesOnly : t.allWords}
                active={favoritesOnly}
                onPress={() => setFavoritesOnly((prev) => !prev)}
              />
              <PillButton
                label={shuffleMode ? t.shuffleOn : t.shuffleOff}
                active={shuffleMode}
                onPress={() => setShuffleMode((prev) => !prev)}
              />
              <Pressable
                style={styles.clearAllButton}
                onPress={clearAllSelections}
              >
                <Text style={styles.clearAllButtonText}>{t.clearAll}</Text>
              </Pressable>
            </View>

            {(selectedCategory ||
              selectedSubcategory !== "ALL" ||
              selectedDifficulty !== "ALL" ||
              favoritesOnly) && (
              <View style={styles.activeFiltersSection}>
                <Text style={styles.activeFiltersLabel}>{t.activeFilters}</Text>
                <View style={styles.activeFilterWrap}>
                  {!!selectedCategory && (
                    <Pressable
                      style={styles.activeFilterChip}
                      onPress={removeCategoryFilter}
                    >
                      <Text style={styles.activeFilterText}>
                        {translateCategory(selectedCategory)} ✕
                      </Text>
                    </Pressable>
                  )}

                  {selectedSubcategory !== "ALL" && (
                    <Pressable
                      style={styles.activeFilterChip}
                      onPress={removeSubcategoryFilter}
                    >
                      <Text style={styles.activeFilterText}>
                        {translateSubcategory(selectedSubcategory)} ✕
                      </Text>
                    </Pressable>
                  )}

                  {selectedDifficulty !== "ALL" && (
                    <Pressable
                      style={styles.activeFilterChip}
                      onPress={removeDifficultyFilter}
                    >
                      <Text style={styles.activeFilterText}>
                        {uiLanguage === "et" ? "Tase" : "레벨"}{" "}
                        {selectedDifficulty} ✕
                      </Text>
                    </Pressable>
                  )}

                  {favoritesOnly && (
                    <Pressable
                      style={styles.activeFilterChip}
                      onPress={removeFavoritesFilter}
                    >
                      <Text style={styles.activeFilterText}>
                        {uiLanguage === "et" ? "Favoriidid" : "즐겨찾기"} ✕
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            <View style={styles.statsCompact}>
              <Text style={styles.statsCompactText}>
                {t.total} {koreaKeel.length}
              </Text>
              <Text style={styles.statsDot}>•</Text>
              <Text style={styles.statsCompactText}>
                {t.filtered} {filteredWords.length}
              </Text>
              <Text style={styles.statsDot}>•</Text>
              <Text style={styles.statsCompactText}>
                {filteredWords.length ? currentIndex + 1 : 0}/{filteredWords.length}
              </Text>
            </View>

            {currentWord ? (
              <View style={styles.wordCard}>
                {studyDirection === "et-ko" ? (
                  <>
                    <Text style={[styles.wordLine, styles.wordPrimary]}>
                      {currentWord.et || currentWord.roman || "-"}
                    </Text>

                    <Text
                      style={[
                        styles.wordLine,
                        styles.wordSecondary,
                        styles.targetWordLine,
                      ]}
                    >
                      {currentWord.kr}
                    </Text>

                    {romanizationVisible &&
                      !!currentWord.roman &&
                      normalizeKey(currentWord.roman) !==
                        normalizeKey(currentWord.et) && (
                        <Text
                          style={[
                            styles.wordLine,
                            styles.romanLine,
                            styles.wordRoman,
                          ]}
                        >
                          {currentWord.roman}
                        </Text>
                      )}
                  </>
                ) : (
                  <>
                    <Text style={[styles.wordLine, styles.wordPrimary]}>
                      {currentWord.kr}
                    </Text>

                    {romanizationVisible && !!currentWord.roman && (
                      <Text
                        style={[
                          styles.wordLine,
                          styles.romanLine,
                          styles.wordRoman,
                        ]}
                      >
                        {currentWord.roman}
                      </Text>
                    )}

                    {!!currentWord.et && (
                      <Text
                        style={[
                          styles.wordLine,
                          styles.wordSecondary,
                          styles.targetWordLine,
                        ]}
                      >
                        {currentWord.et}
                      </Text>
                    )}
                  </>
                )}

                <Pressable
                  style={styles.listenButton}
                  onPress={() => speakSelectedDirection(currentWord)}
                >
                  <Text style={styles.listenButtonText}>
                    {studyDirection === "et-ko"
                      ? `🔊 ${t.listen} · 1×ET + 3×KO`
                      : `🔊 ${t.listen} · 1×KO + 3×ET`}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.autoButton,
                    autoMode !== "off" && styles.autoButtonActive,
                  ]}
                  onPress={toggleAuto}
                >
                  <Text
                    style={[
                      styles.autoButtonText,
                      autoMode !== "off" && styles.autoButtonTextActive,
                    ]}
                  >
                    {autoMode !== "off"
                      ? `■ ${t.stopAuto}`
                      : studyDirection === "et-ko"
                      ? `▶ ${t.autoEtKo}`
                      : `▶ ${t.autoKoEt}`}
                  </Text>
                </Pressable>

                {autoMode !== "off" && (
                  <Text style={styles.autoStatusText}>
                    {t.autoRunning} · {currentIndex + 1} / {filteredWords.length}
                  </Text>
                )}

                <View style={styles.buttonRow}>
                  <Pressable
                    style={styles.navButton}
                    onPress={() => moveIndex("prev")}
                  >
                    <Text style={styles.navButtonText}>{t.prev}</Text>
                  </Pressable>

                  <Pressable
                    style={styles.navButton}
                    onPress={() => moveIndex(shuffleMode ? "random" : "next")}
                  >
                    <Text style={styles.navButtonText}>
                      {shuffleMode ? t.random : t.next}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>{t.emptyWords}</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>{t.wordList}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => setCurrentIndex(index)}
            style={[
              styles.listItem,
              currentWord?.id === item.id && styles.activeListItem,
            ]}
          >
            <View style={styles.listTextWrap}>
              <Text style={styles.listKr}>{item.kr}</Text>

              <Text style={styles.listMeaningLine} numberOfLines={2}>
                {item.roman || "-"}
                {normalizeKey(item.category) !== normalizeKey("Tähestik") &&
                item.et
                  ? ` · ${item.et}`
                  : ""}
              </Text>

              <Text style={styles.listMetaLine} numberOfLines={1}>
                {translateCategory(item.category)}
                {item.subcategory
                  ? ` · ${translateSubcategory(item.subcategory)}`
                  : ""}
                {` · lvl ${item.difficulty || "-"}`}
              </Text>
            </View>

            <View style={styles.itemActionsRight}>
              <Pressable
                style={[styles.compactIconButton, styles.copyIconButton]}
                onPress={() => copyWordCard(item)}
              >
                <Text style={styles.compactIconText}>
                  {copiedWordId === item.id ? "✓" : "📋"}
                </Text>
              </Pressable>

              <Pressable
                style={styles.compactIconButton}
                onPress={() => toggleFavorite(item)}
              >
                <Text style={styles.compactIconText}>
                  {item.is_favorite ? "★" : "☆"}
                </Text>
              </Pressable>

              <Pressable
                style={styles.compactIconButton}
                onPress={() => openEditModal(item)}
              >
                <Text style={styles.compactIconText}>✏️</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      />

      <Modal visible={modalVisible} animationType="slide">
        <SafeAreaView style={styles.modalSafe}>
          <ScrollView contentContainerStyle={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {editingWordId ? t.editWord : t.newWord}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="KR"
              placeholderTextColor="#6B7280"
              value={form.kr}
              onChangeText={(text) => updateForm("kr", text)}
            />

            <TextInput
              style={styles.input}
              placeholder="Roman"
              placeholderTextColor="#6B7280"
              value={form.roman}
              onChangeText={(text) => updateForm("roman", text)}
            />

            <TextInput
              style={styles.input}
              placeholder="ET"
              placeholderTextColor="#6B7280"
              value={form.et}
              onChangeText={(text) => updateForm("et", text)}
            />

            <TextInput
              style={styles.input}
              placeholder="Type"
              placeholderTextColor="#6B7280"
              value={form.type}
              onChangeText={(text) => updateForm("type", text)}
            />

            <TextInput
              style={styles.input}
              placeholder="Difficulty"
              placeholderTextColor="#6B7280"
              value={form.difficulty}
              onChangeText={(text) => updateForm("difficulty", text)}
            />

            <TextInput
              style={styles.input}
              placeholder="Category"
              placeholderTextColor="#6B7280"
              value={form.category}
              onChangeText={(text) => updateForm("category", text)}
            />

            <TextInput
              style={styles.input}
              placeholder="Subcategory"
              placeholderTextColor="#6B7280"
              value={form.subcategory}
              onChangeText={(text) => updateForm("subcategory", text)}
            />

            <View style={styles.controlsWrap}>
              <PillButton
                label={form.is_favorite ? t.favorite : t.notFavorite}
                active={form.is_favorite}
                onPress={() => updateForm("is_favorite", !form.is_favorite)}
              />
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.modalCancelText}>{t.cancel}</Text>
              </Pressable>

              <Pressable style={styles.modalSaveButton} onPress={saveWord}>
                <Text style={styles.modalSaveText}>{t.save}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function PillButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pillButton, active && styles.pillButtonActive]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F6F7FB",
  },
  listContent: {
    paddingBottom: 100,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  container: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  headerTextWrap: {
    flex: 1,
    paddingTop: 2,
  },
  title: {
    fontSize: 27,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: "#4B5563",
  },
  studyDirectionWrap: {
    width: 172,
    alignItems: "center",
  },
  studyDirectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B7280",
    marginBottom: 4,
  },
  langToggle: {
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
    borderRadius: 14,
    padding: 3,
  },
  langToggleButton: {
    minWidth: 78,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 11,
    alignItems: "center",
  },
  langToggleButtonActive: {
    backgroundColor: "#111827",
  },
  langToggleText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
  },
  langToggleTextActive: {
    color: "#FFFFFF",
  },
  directionHint: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "700",
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  romanizationToggle: {
    marginTop: 5,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: "#FFFFFF",
  },
  romanizationToggleActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#818CF8",
  },
  romanizationToggleText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#4B5563",
  },
  romanizationToggleTextActive: {
    color: "#3730A3",
  },
  resumeNotice: {
    marginTop: 8,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resumeNoticeText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    color: "#065F46",
    textAlign: "center",
  },
  topActions: {
    marginTop: 10,
    marginBottom: 2,
  },
  searchSectionNearAdd: {
    marginTop: 2,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  searchFieldWrap: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingLeft: 13,
    paddingRight: 118,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  searchScopeBadge: {
    position: "absolute",
    right: 9,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  searchScopeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6B7280",
  },
  clearSearchButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  clearSearchButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  addButton: {
    marginTop: 7,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    paddingVertical: 10,
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
    marginTop: 13,
    marginBottom: 7,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 7,
  },
  categoryCard: {
    width: "48.8%",
    minHeight: 56,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#111827",
    shadowOpacity: 0.025,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  categoryCardActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
    borderWidth: 2,
  },
  categoryIcon: {
    fontSize: 21,
  },
  categoryTitle: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: "900",
    color: "#111827",
  },
  categoryTitleActive: {
    color: "#FFFFFF",
  },
  subcategoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  controlsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  pillButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillButtonActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  pillText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#111827",
  },
  pillTextActive: {
    color: "#FFFFFF",
  },
  clearAllButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1C7C7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearAllButtonText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#A85D5D",
  },
  activeFiltersSection: {
    marginTop: 10,
  },
  activeFiltersLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B7280",
    marginBottom: 5,
  },
  activeFilterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  activeFilterChip: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  activeFilterText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#3730A3",
  },
  statsCompact: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 2,
  },
  statsCompactText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#4B5563",
  },
  statsDot: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  wordCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 17,
    marginTop: 11,
    shadowColor: "#111827",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  wordLine: {
    color: "#111827",
    letterSpacing: 0.1,
    textAlign: "center",
  },
  wordPrimary: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "900",
  },
  wordSecondary: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "800",
  },
  targetWordLine: {
    marginTop: 6,
  },
  wordRoman: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: "#6B7280",
  },
  romanLine: {
    marginTop: 5,
    marginBottom: 1,
  },
  listenButton: {
    marginTop: 13,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 13,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  listenButtonText: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#312E81",
    textAlign: "center",
  },
  autoButton: {
    marginTop: 8,
    backgroundColor: "#111827",
    borderRadius: 14,
    minHeight: 47,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  autoButtonActive: {
    backgroundColor: "#22C55E",
  },
  autoButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
  },
  autoButtonTextActive: {
    color: "#FFFFFF",
  },
  autoStatusText: {
    marginTop: 6,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "900",
    color: "#15803D",
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 9,
  },
  navButton: {
    flex: 1,
    minHeight: 50,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  navButtonText: {
    fontSize: 15.5,
    fontWeight: "900",
    color: "#111827",
  },
  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
    marginTop: 11,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    color: "#111827",
  },
  listItem: {
    marginHorizontal: 14,
    marginTop: 7,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  activeListItem: {
    borderWidth: 2,
    borderColor: "#111827",
  },
  listTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  listKr: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
    color: "#111827",
  },
  listMeaningLine: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: "700",
    color: "#374151",
    marginTop: 2,
  },
  listMetaLine: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "700",
    color: "#9CA3AF",
    marginTop: 4,
  },
  itemActionsRight: {
    flexDirection: "row",
    gap: 4,
    paddingTop: 1,
  },
  compactIconButton: {
    width: 31,
    height: 31,
    borderRadius: 9,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  copyIconButton: {
    backgroundColor: "#EAF1FF",
  },
  compactIconText: {
    fontSize: 14,
  },
  modalSafe: {
    flex: 1,
    backgroundColor: "#F6F7FB",
  },
  modalContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 14,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 15,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: "#E5E7EB",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
  },
});