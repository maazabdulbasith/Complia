import { useState, useEffect } from "react";
import { Form, Link, useNavigation, useNavigate } from "react-router";
import { searchNotices } from "../api/client";
import { trackEvent } from "../lib/analytics";
import type { Route } from "./+types/home";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Complia - Compliance, Explained." },
    { name: "description", content: "Understand your GST notices in plain English." },
  ];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  if (!q) return { results: [], query: "" };
  const results = await searchNotices(q);
  return { results, query: q };
}

function NoticeSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-8 border border-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-r from-transparent via-slate-50/50 to-transparent -translate-x-full animate-shimmer" />
      <div className="absolute top-6 right-6">
        <div className="w-24 h-6 bg-slate-100 rounded-full" />
      </div>
      <div className="pr-24 space-y-4">
        <div className="w-16 h-5 bg-slate-50 rounded" />
        <div className="w-3/4 h-8 bg-slate-100 rounded-lg" />
        <div className="space-y-2">
          <div className="w-full h-4 bg-slate-50 rounded" />
          <div className="w-5/6 h-4 bg-slate-50 rounded" />
        </div>
      </div>
    </div>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { results, query } = loaderData;
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState(query || "");
  const [user, setUser] = useState<{ email: string; user_type?: string } | null>(null);
  const isLoading = navigation.state === "loading";

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("user");
      }
    }
    trackEvent("page_view", { page: "home" });
  }, []);

  useEffect(() => {
    if (!query || isLoading) {
      return;
    }
    trackEvent("notice_search", {
      query,
      result_count: results.length,
    });
  }, [query, results.length, isLoading]);

  const handleLogout = () => {
    localStorage.removeItem("complia_token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 relative overflow-hidden flex flex-col">
      
      {/* Premium Header */}
      <header className="fixed top-0 inset-x-0 z-50 h-16 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
           <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xl">C</div>
           <span className="font-bold text-lg tracking-tight text-slate-900">Complia</span>
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
               {user.user_type === "admin" && (
                 <Link
                   to="/superadmin"
                   className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-indigo-200 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:border-indigo-300 transition-all"
                 >
                   SuperAdmin
                 </Link>
               )}
               <Link
                 to="/saved"
                 className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all"
               >
                 Saved Notices
               </Link>
               <span className="text-sm font-medium text-slate-600 hidden sm:block">{user.email}</span>
               <button
                 onClick={handleLogout}
                 className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:border-rose-200 transition-all"
               >
                 Logout
               </button>
               <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center text-xs font-bold text-slate-500">
                  {user.email[0].toUpperCase()}
               </div>
            </div>
          ) : (
            <Link 
              to="/login" 
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/10"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Modern Mesh Gradient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-32 relative z-10 flex-grow w-full">

        {/* Hero Section */}
        <div className="text-center mb-16 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-md border border-slate-200/50 shadow-sm text-sm font-semibold text-slate-600 mb-4 animate-in fade-in zoom-in duration-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Deciphering India's complex tax code</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 leading-[1.1]">
            Complia : <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 bg-clip-text text-transparent">Compliance, explained.</span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-500 font-normal max-w-2xl mx-auto leading-relaxed">
            Legal jargon turned into plain English. <br /> Instantly understand your government notice.
          </p>
        </div>

        {/* Modern Search Bar */}
        <div className="max-w-2xl mx-auto bg-white/80 backdrop-blur-xl p-2 rounded-2xl shadow-2xl shadow-indigo-500/10 border border-white/50 mb-16 ring-1 ring-slate-200/50 transition-all focus-within:ring-indigo-500/30 focus-within:shadow-indigo-500/20">
          <Form method="get" className="flex gap-2 relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <input
              type="text"
              name="q"
              placeholder="Search notice code (e.g. ASMT-10)..."
              className="flex-1 bg-transparent border-none text-lg pl-12 pr-4 py-4 focus:outline-none text-slate-900 placeholder:text-slate-400 font-medium tracking-tight"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/10 active:scale-95 flex items-center gap-2"
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              Search
            </button>
          </Form>
        </div>

        {/* Results Area */}
        {isLoading ? (
          <div className="space-y-6">
            <NoticeSkeleton />
            <NoticeSkeleton />
            <NoticeSkeleton />
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex items-baseline justify-between border-b border-slate-200/60 pb-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Found Matches</h2>
            </div>

            {results.map((notice) => (
              <Link
                key={notice.code}
                to={`/notice/${notice.code}`}
                onClick={() => {
                  trackEvent("search_result_clicked", {
                    query,
                    notice_code: notice.code,
                  });
                }}
                className="group relative block bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-100 transition-all duration-300"
              >
                <div className="absolute top-6 right-6">
                  <div className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1.5 ${notice.severity === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                    notice.severity === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${notice.severity === 'high' ? 'bg-rose-500' : notice.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                    {notice.severity === 'high' ? 'Action Required' : notice.severity === 'medium' ? 'Review' : 'Info'}
                  </div>
                </div>

                <div className="pr-24">
                  <span className="inline-block font-mono text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded mb-3">
                    {notice.code}
                  </span>
                  <h3 className="text-2xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors mb-2 tracking-tight">
                    {notice.title}
                  </h3>
                  <p className="text-slate-600 text-lg leading-relaxed">
                    {notice.summary}
                  </p>
                </div>

                <div className="mt-6 flex items-center text-indigo-600 font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                  Read Full Breakdown &rarr;
                </div>
              </Link>
            ))}
          </div>
        ) : query ? (
          <div className="text-center py-24">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-6">
              <span className="text-2xl opacity-50">🔍</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">No matching notices</h3>
            <p className="text-slate-500 mt-2">Try searching for keywords like "Returns" or "Defaulter".</p>
          </div>
        ) : (
          /* Empty State / Suggestions */
          <div className="mt-20 text-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">Frequent Searches</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {["ASMT-10", "DRC-01", "Scrutiny", "Trademark Objection", "PF Hearing"].map((item) => (
                <Link
                  key={item}
                  to={`/?q=${encodeURIComponent(item)}`}
                  onClick={() => {
                    trackEvent("frequent_search_clicked", { term: item });
                  }}
                  className="px-5 py-2.5 bg-white rounded-full border border-slate-200 text-slate-600 text-sm font-medium hover:border-indigo-300 hover:text-indigo-600 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
        )}

      </main>

      <footer className="text-center py-6 relative z-10 text-slate-400 text-sm font-medium">
        <p>Developed by <a href="https://twitter.com/Maazabdulbasith" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-indigo-600 transition-colors">@Maazabdulbasith</a></p>
      </footer>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <div className="p-8 text-center">
        <h1 className="text-3xl font-bold text-red-500 mb-4">Error Loading Data</h1>
        <p className="text-slate-400 mb-4">{error instanceof Error ? error.message : "Verified Backend Connection Failed"}</p>
        <p className="text-sm text-slate-500">Ensure the Django server is running on port 8001.</p>
        <Link to="/" className="text-emerald-400 underline mt-4 block">Go Home</Link>
      </div>
    </div>
  );
}
