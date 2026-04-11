import * as Clipboard from "expo-clipboard";
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
  et: string;
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

const CATEGORY_CONFIG: CategoryConfig[] = [
  {
    id: "tähestik",
    icon: "🔤",
    label: { et: "Tähestik", ko: "알파벳" },
    subcategories: [],
  },
  {
    id: "igapäevaelu",
    icon: "🗣️",
    label: { et: "Igapäevaelu", ko: "일상생활" },
    subcategories: [
      { id: "igapäevane", label: { et: "Igapäevane", ko: "일상 표현" } },
      { id: "vestlus", label: { et: "Vestlus", ko: "회화" } },
      { id: "küsimused", label: { et: "Küsimused", ko: "질문" } },
      { id: "tegevused", label: { et: "Tegevused", ko: "활동" } },
      { id: "aeg", label: { et: "Aeg", ko: "시간" } },
      { id: "rutiin", label: { et: "Rutiin", ko: "루틴" } },
    ],
  },
  {
    id: "suhted ja emotsioonid",
    icon: "❤️",
    label: { et: "Suhted ja emotsioonid", ko: "관계와 감정" },
    subcategories: [
      { id: "suhted", label: { et: "Suhted", ko: "관계" } },
      { id: "armastus", label: { et: "Armastus", ko: "사랑" } },
      { id: "romantika", label: { et: "Romantika", ko: "로맨스" } },
      { id: "emotsioonid", label: { et: "Emotsioonid", ko: "감정" } },
      { id: "viisakus", label: { et: "Viisakus", ko: "예의" } },
      { id: "vabandamine", label: { et: "Vabandamine", ko: "사과" } },
    ],
  },
  {
    id: "perekond",
    icon: "👨‍👩‍👧",
    label: { et: "Perekond", ko: "가족" },
    subcategories: [
      { id: "lähisugulased", label: { et: "Lähisugulased", ko: "가까운 가족" } },
      { id: "sugulased", label: { et: "Sugulased", ko: "친척" } },
    ],
  },
  {
    id: "inimene",
    icon: "🧍",
    label: { et: "Inimene", ko: "사람" },
    subcategories: [
      { id: "pea", label: { et: "Pea", ko: "머리" } },
      { id: "keha", label: { et: "Keha", ko: "몸" } },
      { id: "üldine", label: { et: "Üldine", ko: "일반" } },
      { id: "välimus", label: { et: "Välimus", ko: "외모" } },
    ],
  },
  {
    id: "toit",
    icon: "🍜",
    label: { et: "Toit", ko: "음식" },
    subcategories: [
      { id: "köögiviljad", label: { et: "Köögiviljad", ko: "채소" } },
      {
        id: "puuviljad, marjad, tsitrused",
        label: { et: "Puuviljad, marjad, tsitrused", ko: "과일, 베리, 감귤류" },
      },
      { id: "liha ja mereannid", label: { et: "Liha ja mereannid", ko: "고기와 해산물" } },
      { id: "piim ja munad", label: { et: "Piim ja munad", ko: "유제품과 달걀" } },
      { id: "saiatooted", label: { et: "Saiatooted", ko: "빵류" } },
      { id: "kuivained, pähklid", label: { et: "Kuivained, pähklid", ko: "건식재료, 견과류" } },
      { id: "õlid", label: { et: "Õlid", ko: "오일" } },
      { id: "maitseained", label: { et: "Maitseained", ko: "양념" } },
      { id: "konservtoidud", label: { et: "Konservtoidud", ko: "통조림 식품" } },
      { id: "külmutatud", label: { et: "Külmutatud", ko: "냉동식품" } },
      { id: "road", label: { et: "Road", ko: "요리" } },
      { id: "valmistoit", label: { et: "Valmistoit", ko: "즉석식품" } },
      { id: "maiustused ja snäkid", label: { et: "Maiustused ja snäkid", ko: "간식과 디저트" } },
      { id: "joogid", label: { et: "Joogid", ko: "음료" } },
      { id: "alkohol", label: { et: "Alkohol", ko: "술" } },
    ],
  },
  {
    id: "liikumine ja kohad",
    icon: "🚗",
    label: { et: "Liikumine ja kohad", ko: "이동과 장소" },
    subcategories: [
      { id: "transport", label: { et: "Transport", ko: "교통" } },
      { id: "asukoht", label: { et: "Asukoht", ko: "위치" } },
      { id: "suunad", label: { et: "Suunad", ko: "방향" } },
      { id: "ostlemine", label: { et: "Ostlemine", ko: "쇼핑" } },
      { id: "teenused / ilu", label: { et: "Teenused / ilu", ko: "서비스 / 뷰티" } },
      { id: "restoranis", label: { et: "Restoranis", ko: "식당에서" } },
    ],
  },
  {
    id: "reisimine",
    icon: "✈️",
    label: { et: "Reisimine", ko: "여행" },
    subcategories: [
      { id: "lennujaam", label: { et: "Lennujaam", ko: "공항" } },
      { id: "hotell", label: { et: "Hotell", ko: "호텔" } },
      { id: "piletid", label: { et: "Piletid", ko: "티켓" } },
      { id: "turism", label: { et: "Turism", ko: "관광" } },
    ],
  },
  {
    id: "tervis",
    icon: "🩺",
    label: { et: "Tervis", ko: "건강" },
    subcategories: [
      { id: "sümptomid", label: { et: "Sümptomid", ko: "증상" } },
      { id: "arst", label: { et: "Arst", ko: "의사" } },
      { id: "haigused", label: { et: "Haigused", ko: "질병" } },
      { id: "apteek", label: { et: "Apteek", ko: "약국" } },
    ],
  },
  {
    id: "töö ja kool",
    icon: "🎓",
    label: { et: "Töö ja kool", ko: "직장과 학교" },
    subcategories: [
      { id: "töö", label: { et: "Töö", ko: "직장" } },
      { id: "kool", label: { et: "Kool", ko: "학교" } },
    ],
  },
  {
    id: "raha",
    icon: "💰",
    label: { et: "Raha", ko: "돈" },
    subcategories: [
      { id: "raha", label: { et: "Raha", ko: "돈" } },
      { id: "maksmine", label: { et: "Maksmine", ko: "결제" } },
      { id: "hinnad", label: { et: "Hinnad", ko: "가격" } },
      { id: "pank", label: { et: "Pank", ko: "은행" } },
    ],
  },
  {
    id: "tehnoloogia",
    icon: "🌐",
    label: { et: "Tehnoloogia", ko: "기술" },
    subcategories: [
      { id: "telefon", label: { et: "Telefon", ko: "전화" } },
      { id: "arvuti", label: { et: "Arvuti", ko: "컴퓨터" } },
      { id: "internet", label: { et: "Internet", ko: "인터넷" } },
      { id: "äpid", label: { et: "Äpid", ko: "앱" } },
    ],
  },
  {
    id: "esemed ja asjad",
    icon: "📦",
    label: { et: "Esmed ja asjad", ko: "물건과 소지품" },
    subcategories: [
      { id: "koduesemed", label: { et: "Koduesemed", ko: "생활용품" } },
      { id: "riided", label: { et: "Riided", ko: "옷" } },
      { id: "ehted", label: { et: "Ehted", ko: "장신구" } },
      { id: "isiklikud esemed", label: { et: "Isiklikud esemed", ko: "개인 소지품" } },
    ],
  },
  {
    id: "meelelahutus",
    icon: "🎬",
    label: { et: "Meelelahutus", ko: "엔터테인먼트" },
    subcategories: [
      { id: "kdrama", label: { et: "K-drama", ko: "한국 드라마" } },
      { id: "kino", label: { et: "Kino", ko: "영화관" } },
      { id: "teater", label: { et: "Teater", ko: "극장" } },
      { id: "kontsert", label: { et: "Kontsert", ko: "콘서트" } },
    ],
  },
  {
    id: "keelevormid",
    icon: "🗨️",
    label: { et: "Keelevormid", ko: "문법과 표현" },
    subcategories: [
      { id: "tegusõnad", label: { et: "Tegusõnad", ko: "동사" } },
      { id: "määrsõna", label: { et: "Määrsõna", ko: "부사" } },
      { id: "omadussõnad", label: { et: "Omadussõnad", ko: "형용사" } },
      { id: "nimisõnad", label: { et: "Nimisõnad", ko: "명사" } },
      { id: "ajavormid", label: { et: "Ajavormid", ko: "시제" } },
      { id: "lauseehitus", label: { et: "Lauseehitus", ko: "문장 구조" } },
      { id: "släng", label: { et: "Släng", ko: "속어" } },
      { id: "numbrid", label: { et: "Numbrid", ko: "숫자" } },
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
  },
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeKey = (value: string | null | undefined) =>
  (value || "").trim().toLowerCase();

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
  const [selectedDifficulty, setSelectedDifficulty] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState("ALL");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [copiedWordId, setCopiedWordId] = useState<string | null>(null);

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
      result = result.filter((item) =>
        normalizeKey(item.category).includes(normalizeKey(selectedCategory))
      );
    } else {
      return [];
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

    const { data, error } = await supabase
      .from("korea_keel")
      .select(
        "id, created_at, kr, et, roman, type, difficulty, category, subcategory, is_favorite"
      )
      .order("created_at", { ascending: true });

    if (error) {
      Alert.alert(UI_TEXT.et.error, error.message);
      setLoading(false);
      return;
    }

    setKoreaKeel((data || []) as KoreaKeelRow[]);
    setLoading(false);
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
    setStudyDirection("et-ko");
    await stopSpeech();
    await speakOnce(word.et, "et-EE", 0.88);
    await wait(360);
    await speakOnce(word.kr, "ko-KR", 0.42);
    await wait(260);
    await speakOnce(word.kr, "ko-KR", 0.9);
  };

  const speakKoEtSequence = async (word: KoreaKeelRow) => {
    setStudyDirection("ko-et");
    await stopSpeech();
    await speakOnce(word.kr, "ko-KR", 0.9);
    await wait(360);
    await speakOnce(word.et, "et-EE", 0.74);
    await wait(260);
    await speakOnce(word.et, "et-EE", 0.9);
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
    loadWords();
    loadVoices();
  }, []);

  useEffect(() => {
    autoModeRef.current = autoMode;
  }, [autoMode]);

  useEffect(() => {
    setSelectedSubcategory("ALL");
    setCurrentIndex(0);
  }, [selectedCategory]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedSubcategory, selectedDifficulty, favoritesOnly]);

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

  const primaryIsKo = studyDirection === "et-ko";

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

              <View style={styles.langToggle}>
                <Pressable
                  onPress={() => setUiLanguage("et")}
                  style={[
                    styles.langToggleButton,
                    uiLanguage === "et" && styles.langToggleButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.langToggleText,
                      uiLanguage === "et" && styles.langToggleTextActive,
                    ]}
                  >
                    ET
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setUiLanguage("ko")}
                  style={[
                    styles.langToggleButton,
                    uiLanguage === "ko" && styles.langToggleButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.langToggleText,
                      uiLanguage === "ko" && styles.langToggleTextActive,
                    ]}
                  >
                    KO
                  </Text>
                </Pressable>
              </View>
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
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <Text style={styles.categoryIcon}>{category.icon}</Text>
                    <Text
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

                <ScrollView
                  horizontal={false}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.subcategoryWrap}
                >
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
                      onPress={() => setSelectedSubcategory(subcategory.id)}
                    />
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={styles.sectionTitle}>{t.level}</Text>
            <View style={styles.controlsWrap}>
              {DIFFICULTY_OPTIONS.map((level) => (
                <PillButton
                  key={level}
                  label={level === "ALL" ? "ALL" : `Level ${level}`}
                  active={selectedDifficulty === level}
                  onPress={() => setSelectedDifficulty(level)}
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
            </View>

            <View style={styles.statsBox}>
              <Text style={styles.statsText}>
                {t.total}: {koreaKeel.length}
              </Text>
              <Text style={styles.statsText}>
                {t.filtered}: {filteredWords.length}
              </Text>
              <Text style={styles.statsText}>
                {t.selected}:{" "}
                {selectedCategory ? translateCategory(selectedCategory) : "-"}
              </Text>
              {!!selectedCategory && (
                <Text style={styles.statsText}>
                  {t.subcategory}:{" "}
                  {selectedSubcategory === "ALL"
                    ? t.allSubcategories
                    : translateSubcategory(selectedSubcategory)}
                </Text>
              )}
            </View>

            {selectedCategory && currentWord ? (
              <View style={styles.wordCard}>
                <Text
                  style={[
                    styles.wordLine,
                    primaryIsKo ? styles.wordPrimary : styles.wordSecondary,
                  ]}
                >
                  {currentWord.kr}
                </Text>

                <Text style={[styles.wordLine, styles.romanLine, styles.wordRoman]}>
                  {currentWord.roman || "-"}
                </Text>

                <Text
                  style={[
                    styles.wordLine,
                    !primaryIsKo ? styles.wordPrimary : styles.wordSecondary,
                  ]}
                >
                  {currentWord.et}
                </Text>

                <View style={styles.metaWrap}>
                  <Text style={styles.metaBadge}>
                    {t.type}: {getTypeLabel(currentWord.type, uiLanguage)}
                  </Text>
                  <Text style={styles.metaBadge}>
                    {t.difficulty}: {currentWord.difficulty || "-"}
                  </Text>
                  <Text style={styles.metaBadge}>
                    {t.category}: {translateCategory(currentWord.category)}
                  </Text>
                  {!!currentWord.subcategory && (
                    <Text style={styles.metaBadge}>
                      {t.subcategory}:{" "}
                      {translateSubcategory(currentWord.subcategory)}
                    </Text>
                  )}
                </View>

                <View style={styles.buttonRow}>
                  <Pressable
                    style={[
                      styles.primaryButton,
                      studyDirection === "et-ko" && styles.directionButtonActive,
                    ]}
                    onPress={() => speakEtKoSequence(currentWord)}
                  >
                    <Text style={styles.primaryButtonText}>{t.etToKo}</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.primaryButton,
                      studyDirection === "ko-et" && styles.directionButtonActive,
                    ]}
                    onPress={() => speakKoEtSequence(currentWord)}
                  >
                    <Text style={styles.primaryButtonText}>{t.koToEt}</Text>
                  </Pressable>
                </View>

                <View style={styles.buttonRow}>
                  <Pressable
                    style={[
                      styles.secondaryButton,
                      autoMode === "et-ko" && styles.activeModeButton,
                    ]}
                    onPress={() =>
                      setAutoMode((prev) => (prev === "et-ko" ? "off" : "et-ko"))
                    }
                  >
                    <Text style={styles.secondaryButtonText}>
                      {autoMode === "et-ko" ? t.stopAutoEtKo : t.autoEtKo}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.secondaryButton,
                      autoMode === "ko-et" && styles.activeModeButton,
                    ]}
                    onPress={() =>
                      setAutoMode((prev) => (prev === "ko-et" ? "off" : "ko-et"))
                    }
                  >
                    <Text style={styles.secondaryButtonText}>
                      {autoMode === "ko-et" ? t.stopAutoKoEt : t.autoKoEt}
                    </Text>
                  </Pressable>
                </View>

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
                <Text style={styles.emptyText}>
                  {selectedCategory ? t.emptyWords : t.emptyCategory}
                </Text>
              </View>
            )}

            <View style={styles.topActions}>
              <Pressable style={styles.addButton} onPress={openAddModal}>
                <Text style={styles.addButtonText}>{t.addWord}</Text>
              </Pressable>
            </View>

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
            <View style={styles.itemActionsLeft}>
              <Pressable
                style={[styles.iconButton, styles.copyIconButton]}
                onPress={() => copyWordCard(item)}
              >
                <Text style={styles.iconText}>📋</Text>
              </Pressable>

              {copiedWordId === item.id ? (
                <Text style={styles.copiedFeedback}>{t.copied}</Text>
              ) : (
                <View style={styles.feedbackSpacer} />
              )}

              <Pressable
                style={styles.iconButton}
                onPress={() => toggleFavorite(item)}
              >
                <Text style={styles.iconText}>
                  {item.is_favorite ? "★" : "☆"}
                </Text>
              </Pressable>

              <Pressable
                style={styles.iconButton}
                onPress={() => openEditModal(item)}
              >
                <Text style={styles.iconText}>✏️</Text>
              </Pressable>
            </View>

            <View style={styles.listTextWrap}>
              <Text style={styles.listKr}>{item.kr}</Text>
              <Text style={styles.listRoman}>{item.roman || "-"}</Text>
              <Text style={styles.listEt}>{item.et}</Text>

              <View style={styles.listMetaWrap}>
                <Text style={styles.listMeta}>
                  {translateCategory(item.category)}
                </Text>
                {!!item.subcategory && (
                  <Text style={styles.listMeta}>
                    {translateSubcategory(item.subcategory)}
                  </Text>
                )}
                <Text style={styles.listMeta}>lvl {item.difficulty || "-"}</Text>
              </View>
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
    paddingBottom: 120,
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
    padding: 16,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 31,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: "#111827",
  },
  langToggle: {
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
    borderRadius: 16,
    padding: 4,
  },
  langToggleButton: {
    minWidth: 52,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  langToggleButtonActive: {
    backgroundColor: "#111827",
  },
  langToggleText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  langToggleTextActive: {
    color: "#FFFFFF",
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#111827",
    marginTop: 20,
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  categoryCard: {
    width: "48%",
    minHeight: 112,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
    justifyContent: "space-between",
    shadowColor: "#111827",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  categoryCardActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  categoryIcon: {
    fontSize: 28,
  },
  categoryTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#111827",
  },
  categoryTitleActive: {
    color: "#FFFFFF",
  },
  subcategoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  controlsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pillButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pillButtonActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  pillText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  pillTextActive: {
    color: "#FFFFFF",
  },
  statsBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginTop: 16,
  },
  statsText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  wordCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 22,
    marginTop: 16,
    shadowColor: "#111827",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  wordLine: {
    color: "#111827",
    letterSpacing: 0.2,
  },
  wordPrimary: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "900",
  },
  wordSecondary: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "800",
  },
  wordRoman: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
    color: "#111827",
  },
  romanLine: {
    marginTop: 10,
    marginBottom: 10,
  },
  metaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 18,
  },
  metaBadge: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: "hidden",
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  directionButtonActive: {
    borderWidth: 2,
    borderColor: "#6366F1",
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#E5E7EB",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  activeModeButton: {
    backgroundColor: "#D1FAE5",
  },
  secondaryButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
    paddingHorizontal: 8,
  },
  navButton: {
    flex: 1,
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#312E81",
  },
  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 22,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "700",
    color: "#111827",
  },
  topActions: {
    marginTop: 16,
    marginBottom: 4,
  },
  addButton: {
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  listItem: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  activeListItem: {
    borderWidth: 2,
    borderColor: "#111827",
  },
  itemActionsLeft: {
    width: 58,
    alignItems: "center",
    gap: 10,
    paddingTop: 2,
  },
  listTextWrap: {
    flex: 1,
    paddingRight: 2,
  },
  listKr: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: "#111827",
  },
  listRoman: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
    color: "#111827",
    marginTop: 6,
  },
  listEt: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
    color: "#111827",
    marginTop: 6,
  },
  listMetaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  listMeta: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  copyIconButton: {
    backgroundColor: "#EAF1FF",
  },
  iconText: {
    fontSize: 18,
  },
  copiedFeedback: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
    minHeight: 16,
  },
  feedbackSpacer: {
    minHeight: 16,
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