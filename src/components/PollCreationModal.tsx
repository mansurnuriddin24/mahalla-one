import React, { useState } from 'react';
import {
  Vote,
  X,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  Sparkles,
  HelpCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export interface PollFormData {
  question: string;
  options: string[];
  closingDate?: string;
  neighborhoodId?: string;
}

interface PollCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PollFormData) => Promise<void>;
  neighborhoodId?: string;
  neighborhoodName?: string;
}

const TEMPLATE_QUESTIONS = [
  {
    title: "Obodonlashtirish",
    question: "Mahallamiz ichki ko'chalariga qo'shimcha tungi yoritgichlar o'rnatishni qo'llab-quvvatlaysizmi?",
    options: ["Ha, juda zarur", "Yo'q, hozircha kerak emas", "Faqat markaziy ko'chalarga"]
  },
  {
    title: "Chiqindi & Tozalik",
    question: "Mahalla hududida chiqindi saralash qutilari (plastmassa, qog'oz, shisha) tashkil qilinsinmi?",
    options: ["Ha, albatta", "Faqat umumiy chiqindi qutisi yetarli", "Boshqa taklifim bor"]
  },
  {
    title: "Bolalar maydonchasi",
    question: "Ko'p qavatli uylar oralig'ida yangi bolalar sport maydonchasi qurish taklifi ma'qullansinmi?",
    options: ["Ha, qo'llab-quvvatlayman", "Yo'q, dam olish xiyoboni ma'qul", "Qarshiman"]
  }
];

export const PollCreationModal: React.FC<PollCreationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  neighborhoodId,
  neighborhoodName,
}) => {
  const [question, setQuestion] = useState<string>('');
  const [options, setOptions] = useState<string[]>([
    "Ha, qo'llab-quvvatlayman",
    "Yo'q, qarshiman",
  ]);
  const [closingDate, setClosingDate] = useState<string>(() => {
    // Default closing date 7 days in the future
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length >= 8) {
      setError("Ko'pi bilan 8 ta javob varianti kiritish mumkin.");
      return;
    }
    setError(null);
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      setError("So'rovnomada kamida 2 ta variant bo'lishi shart.");
      return;
    }
    setError(null);
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
    if (error) setError(null);
  };

  const handleApplyTemplate = (tmpl: typeof TEMPLATE_QUESTIONS[0]) => {
    setQuestion(tmpl.question);
    setOptions(tmpl.options);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedQuestion = question.trim();
    if (trimmedQuestion.length < 5) {
      setError("Savol matni kamida 5 ta belgidan iborat bo'lishi kerak.");
      return;
    }

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setError("Kamida 2 ta to'ldirilgan javob varianti talab etiladi.");
      return;
    }

    // Check for duplicates
    const uniqueOptions = new Set(cleanOptions.map((o) => o.toLowerCase()));
    if (uniqueOptions.size !== cleanOptions.length) {
      setError("Javob variantlari bir-birini takrorlamasligi kerak.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        question: trimmedQuestion,
        options: cleanOptions,
        closingDate: closingDate || undefined,
        neighborhoodId,
      });

      // Reset and close
      setQuestion('');
      setOptions(["Ha, qo'llab-quvvatlayman", "Yo'q, qarshiman"]);
      onClose();
    } catch (err: any) {
      setError(err?.message || "So'rovnoma yaratishda xatolik yuz berdi");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 relative animate-fade-in my-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-[#16834B] flex items-center justify-center shadow-xs">
              <Vote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#16834B] bg-emerald-50 px-2 py-0.5 rounded-md">
                  Mahalla Raisi
                </span>
                {neighborhoodName && (
                  <span className="text-xs text-slate-500 font-medium">
                    · {neighborhoodName}
                  </span>
                )}
              </div>
              <h2 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight mt-0.5">
                Yangi jamoatchilik so'rovnomasi
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            title="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Templates */}
        <div className="mt-4 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tezkor shablonlar:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_QUESTIONS.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyTemplate(tmpl)}
                className="px-2.5 py-1 text-xs bg-white hover:bg-emerald-50 hover:text-[#16834B] text-slate-700 font-medium rounded-lg border border-slate-200 hover:border-emerald-200 transition-colors shadow-2xs"
              >
                {tmpl.title}
              </button>
            ))}
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span className="flex-1 font-medium">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Question Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              So'rovnoma savoli <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="Masalan: Mahalla hududidagi ko'cha chiroqlarini tungi soat 01:00 dan keyin tejamkor rejimga o'tkazishni ma'qullaysizmi?"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (error) setError(null);
              }}
              className="w-full text-xs md:text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16834B]/30 focus:border-[#16834B] transition-all resize-none"
            />
            <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-slate-600" />
              Savol mahalla fuqarolari uchun tushunarli va aniq bo'lishi lozim.
            </p>
          </div>

          {/* Options List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Javob variantlari <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-600 font-medium">
                {options.length}/8 variant
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {options.map((option, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    required
                    placeholder={`Variant ${idx + 1}`}
                    value={option}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    className="flex-1 text-xs md:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16834B]/30 focus:border-[#16834B] transition-all"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Variantni o'chirish"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 8 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#16834B] font-semibold hover:bg-emerald-50 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yana variant qo'shish</span>
              </button>
            )}
          </div>

          {/* Closing Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              So'rovnoma yakunlanish sanasi
            </label>
            <div className="relative">
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                className="w-full text-xs md:text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16834B]/30 focus:border-[#16834B] transition-all"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              Ushbu muddatdan so'ng ovoz berish avtomatik to'xtatiladi.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-[#16834B] hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saqlanmoqda...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>So'rovnomani e'lon qilish</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
