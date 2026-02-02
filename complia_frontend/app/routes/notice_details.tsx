import type { Route } from "./+types/notice_details";
import { getNotice, submitFeedback } from "../api/client";
import { Link } from "react-router";
import { useState } from "react";

export async function loader({ params }: Route.LoaderArgs) {
    const notice = await getNotice(params.id);
    return { notice };
}

export default function NoticeDetails({ loaderData }: Route.ComponentProps) {
    const { notice } = loaderData;
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    const [showCommentInput, setShowCommentInput] = useState(false);
    const [comment, setComment] = useState("");

    const handleFeedback = async (isHelpful: boolean, text?: string) => {
        try {
            await submitFeedback(notice.id, isHelpful, text);
            setFeedbackSubmitted(true);
        } catch (error) {
            console.error("Feedback failed", error);
        }
    };

    const severityMap = {
        high: { label: "Action Required", styles: "bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/10" },
        medium: { label: "Review Needed", styles: "bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/10" },
        low: { label: "Informational", styles: "bg-blue-50 text-blue-700 border-blue-200 ring-blue-500/10" },
    };

    const statusObj = severityMap[notice.severity];

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 relative overflow-hidden flex flex-col">

            {/* Background Blobs */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-30">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl"></div>
                <div className="absolute top-[20%] left-[-10%] w-[30%] h-[30%] bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl"></div>
            </div>

            <main className="max-w-4xl mx-auto px-6 py-12 relative z-10 flex-grow w-full">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 backdrop-blur-sm border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-white hover:text-indigo-600 transition-all mb-8 shadow-sm hover:shadow-md"
                >
                    &larr; Search again
                </Link>

                {/* Modern Glass Card */}
                <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl shadow-slate-200/50 overflow-hidden ring-1 ring-slate-100">

                    {/* Header */}
                    <div className="p-8 md:p-12 border-b border-slate-100">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-8 gap-6">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                        {notice.code}
                                    </span>
                                    {notice.source_section && (
                                        <span className="text-xs font-semibold text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                            Ref: {notice.source_section}
                                        </span>
                                    )}
                                </div>
                                <h1 className="text-3xl md:text-5xl font-bold text-slate-900 leading-[1.1] tracking-tight">
                                    {notice.title}
                                </h1>
                            </div>
                            <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border ring-4 self-start whitespace-nowrap ${statusObj.styles}`}>
                                {statusObj.label}
                            </span>
                        </div>

                        <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-100">
                            <p className="text-xl text-slate-700 font-medium leading-relaxed">{notice.summary}</p>
                        </div>
                    </div>

                    {/* Content Body */}
                    <div className="p-8 md:p-12 space-y-16">

                        {/* Why & What */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                            <div className="md:col-span-2 space-y-12">
                                <section>
                                    <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">1</span>
                                        Explanation
                                    </h2>
                                    <p className="text-lg leading-8 text-slate-600 whitespace-pre-line">
                                        {notice.detailed_explanation}
                                    </p>
                                </section>

                                {notice.why_received && (
                                    <section>
                                        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                                            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">2</span>
                                            Why did I receive this?
                                        </h2>
                                        <div className="pl-6 border-l-4 border-indigo-500 text-lg text-slate-700 italic leading-relaxed bg-slate-50 py-4 pr-4 rounded-r-xl">
                                            "{notice.why_received}"
                                        </div>
                                    </section>
                                )}
                            </div>

                            <div className="md:col-span-1 space-y-8">
                                {notice.common_mistakes && (
                                    <section className="bg-rose-50 p-6 rounded-2xl border border-rose-100 shadow-sm">
                                        <h2 className="text-rose-900 font-bold text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                                            <span className="text-xl">⚠️</span> Common Mistakes
                                        </h2>
                                        <p className="text-rose-800/90 leading-relaxed font-medium">
                                            {notice.common_mistakes}
                                        </p>
                                    </section>
                                )}

                                <section className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h2 className="text-slate-500 font-bold text-sm uppercase tracking-wide mb-4">If Ignored</h2>
                                    <p className="text-slate-600 leading-relaxed font-medium">
                                        {notice.consequences_of_ignoring}
                                    </p>
                                </section>
                            </div>
                        </div>

                        {/* Action Plan */}
                        <section className="bg-indigo-600 rounded-2xl p-8 md:p-10 shadow-xl shadow-indigo-200 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                            <h2 className="text-white font-bold text-2xl mb-6 relative z-10">Recommended Next Steps</h2>
                            <div className="prose prose-invert prose-lg text-indigo-50 relative z-10">
                                <p className="whitespace-pre-line leading-relaxed">{notice.next_steps}</p>
                            </div>
                        </section>

                        {/* CTA */}
                        <div className="flex flex-col items-center justify-center pt-8 border-t border-slate-100">
                            <p className="text-slate-400 font-medium mb-6">Need professional help?</p>
                            <button className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-8 py-4 rounded-xl font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 w-full md:w-auto">
                                Find a Chartered Accountant
                            </button>
                        </div>

                    </div>
                </div>

                {/* Blue Feedback Widget */}
                <div className="mt-16 max-w-lg mx-auto">
                    {!feedbackSubmitted ? (
                        <div className="bg-blue-600 rounded-2xl border border-blue-500 p-8 text-center shadow-xl shadow-blue-500/20 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none"></div>

                            <p className="font-bold text-xl mb-6 relative z-10">Did this explanation help?</p>
                            <div className="flex justify-center gap-4 relative z-10">
                                <button
                                    onClick={() => handleFeedback(true)}
                                    className="px-8 py-3 bg-white text-blue-700 hover:bg-blue-50 border border-transparent rounded-xl transition-all font-bold shadow-md hover:scale-105 active:scale-95"
                                >
                                    👍 Yes
                                </button>
                                <button
                                    onClick={() => setShowCommentInput(true)}
                                    className="px-8 py-3 bg-blue-700/50 text-white hover:bg-blue-700 border border-blue-500/50 rounded-xl transition-all font-bold shadow-sm"
                                >
                                    👎 No
                                </button>
                            </div>

                            {showCommentInput && (
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleFeedback(false, comment);
                                    }}
                                    className="mt-6 animate-in fade-in slide-in-from-top-2 relative z-10"
                                >
                                    <textarea
                                        className="w-full bg-blue-800/50 border border-blue-500/50 rounded-xl p-4 text-white placeholder:text-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-inner"
                                        placeholder="What was unclear? (Optional)"
                                        rows={3}
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                    />
                                    <button
                                        type="submit"
                                        className="mt-4 px-6 py-2 bg-white text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors"
                                    >
                                        Submit
                                    </button>
                                </form>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 bg-emerald-500 text-white rounded-2xl shadow-lg border border-emerald-400 animate-in fade-in zoom-in">
                            <span className="text-3xl block mb-2">🎉</span>
                            <p className="font-bold text-lg">Thanks for helping us improve!</p>
                        </div>
                    )}
                </div>

                {/* Friendly Disclaimer */}
                <div className="mt-16 text-center text-slate-400 text-xs max-w-xl mx-auto leading-relaxed opacity-60 hover:opacity-100 transition-opacity">
                    <p>
                        <strong>Disclaimer:</strong> Complia is an informational tool. Always verify with your actual notice and consult a qualified CA.
                    </p>
                </div>

            </main>

            <footer className="text-center py-6 relative z-10 text-slate-400 text-sm font-medium">
                <p>Developed by <a href="https://twitter.com/Maazabdulbasith" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-indigo-600 transition-colors">@Maazabdulbasith</a></p>
            </footer>
        </div>
    );
}
