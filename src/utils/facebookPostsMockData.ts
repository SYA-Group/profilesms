/**
 * Frontend-only mock for Facebook Posts Extraction Results design review.
 * USE_MOCK_EXTRACTION_RESULTS = false → Real Batch Mode (Phase 1B TXT + queued create).
 * USE_MOCK_EXTRACTION_RESULTS = true → Design Mock Mode (100 fake rows, no API).
 * Keep this dataset isolated; do not show mock rows during Real Batch Mode.
 */

export const USE_MOCK_EXTRACTION_RESULTS = false;

export const MOCK_PAGE_SIZE = 20;

export type MockExtractionStatus =
  | "completed"
  | "running"
  | "pending"
  | "failed";

export interface MockExtractionResult {
  id: number;
  name: string;
  profileUrl: string;
  profileUrlDisplay: string;
  avatarUrl: string;
  comment: string;
  phone: string;
  status: MockExtractionStatus;
  updated: string;
}

const FIRST = [
  "Ahmed",
  "Mohamed",
  "Sara",
  "Fatma",
  "Youssef",
  "Nour",
  "Omar",
  "Layla",
  "Hassan",
  "Mariam",
  "Karim",
  "Hana",
  "Tarek",
  "Dina",
  "Mostafa",
  "Rania",
  "Amr",
  "Salma",
  "Ibrahim",
  "Nada",
];

const LAST = [
  "Mohamed",
  "Ali",
  "Hassan",
  "Ibrahim",
  "Mahmoud",
  "Said",
  "Farouk",
  "Gamal",
  "Nabil",
  "Osman",
  "Khaled",
  "Samir",
  "Fathy",
  "Adel",
  "Yehia",
];

const SHORT_COMMENTS = [
  "مهتم",
  "تمام",
  "عايز تفاصيل أكتر",
  "كام السعر؟",
  "ممتاز",
  "أبعت رقمك",
  "وين المكان؟",
  "شكراً",
  "حاضر",
  "أوافق",
];

const LONG_COMMENTS = [
  "ممكن تفاصيل أكتر من فضلك أنا مهتم جدًا بالعربية وعايز أعرف مواعيد الحضور والأسعار وطريقة التسجيل كاملة قبل ما أحجز.",
  "السلام عليكم، شفت الإعلان وعايز أعرف هل فيه خصم للمجموعات ولو في مواعيد مسائية تناسب الناس اللي بتشتغل، وكم مدة الدورة تقريبًا؟",
  "أنا مهتم بالخدمة دي من فترة وعايز أتأكد من جودة المحتوى وهل الشهادات معتمدة ولا لأ، وكمان هل فيه دعم بعد الانتهاء من الكورس؟",
  "هل ينفع أحجز لشخصين بنفس السعر؟ ولو فيه عرض حالي ابعتولي التفاصيل على الخاص لو سمحتوا لأن الرقم مش بيرد أحيانًا.",
  "تعليق طويل جدًا عن التجربة: حضرت جلسة تجريبية وكانت جيدة لكن محتاج توضيح أكثر بخصوص المواد التعليمية والمتابعة الأسبوعية والتقييم النهائي.",
];

const PHONES = [
  "0101 234 5678",
  "0112 345 6789",
  "0120 555 8899",
  "0155 112 3344",
  "0109 876 5432",
  "0114 221 9988",
  "0122 333 4455",
  "0106 777 8899",
  "0110 444 5566",
  "0128 999 0011",
];

const UPDATED = [
  "Just now",
  "2 min ago",
  "5 min ago",
  "10 min ago",
  "15 min ago",
  "24 min ago",
  "1 hour ago",
  "3 hours ago",
  "Yesterday",
];

function statusForIndex(i: number): MockExtractionStatus {
  if (i % 17 === 0) return "failed";
  if (i % 13 === 0) return "running";
  if (i % 11 === 0) return "pending";
  return "completed";
}

function buildMockResults(count: number): MockExtractionResult[] {
  const rows: MockExtractionResult[] = [];
  for (let i = 1; i <= count; i++) {
    const first = FIRST[(i - 1) % FIRST.length];
    const last = LAST[(i * 3) % LAST.length];
    const name =
      i % 9 === 0
        ? `${first} ${last} ${LAST[(i * 5) % LAST.length]} El-${FIRST[i % FIRST.length]}`
        : `${first} ${last}`;
    const slug = `${first.toLowerCase()}.${last.toLowerCase()}.${90 + (i % 40)}`;
    const profileUrl =
      i % 7 === 0
        ? `https://www.facebook.com/profile.php?id=1000${String(800000000 + i).slice(0, 9)}&sk=about_contact_and_basic_info`
        : `https://www.facebook.com/${slug}`;
    const profileUrlDisplay =
      i % 7 === 0
        ? `facebook.com/profile.php?id=1000${String(800000000 + i).slice(0, 9)}`
        : `facebook.com/${slug}`;
    const comment =
      i % 5 === 0 || i % 8 === 0
        ? LONG_COMMENTS[i % LONG_COMMENTS.length]
        : SHORT_COMMENTS[i % SHORT_COMMENTS.length];

    rows.push({
      id: i,
      name,
      profileUrl,
      profileUrlDisplay,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(
        name
      )}&background=${["2563EB", "0F172A", "64748B", "16A34A", "F97316"][i % 5]}&color=fff&size=80`,
      comment,
      phone: PHONES[i % PHONES.length],
      status: statusForIndex(i),
      updated: UPDATED[i % UPDATED.length],
    });
  }
  return rows;
}

export const MOCK_EXTRACTION_RESULTS: MockExtractionResult[] =
  buildMockResults(100);

export function exportMockResultsCsv(rows: MockExtractionResult[]): string {
  const header = [
    "Name",
    "Profile URL",
    "Comment",
    "Phone Number",
    "Status",
    "Updated",
  ];
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.name,
        r.profileUrl,
        r.comment,
        r.phone,
        r.status,
        r.updated,
      ]
        .map(escape)
        .join(",")
    ),
  ];
  return lines.join("\n");
}
