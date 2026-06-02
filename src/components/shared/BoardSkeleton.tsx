export const BoardSkeleton = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col animate-pulse">
      {/* Шапка-скелетон */}
      <div className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-slate-200 rounded-lg" />
          <div className="h-5 w-48 bg-slate-200 rounded-md" />
        </div>
        <div className="h-8 w-24 bg-slate-200 rounded-lg" />
      </div>

      {/* Сетка колонок-скелетонов */}
      <div className="flex-1 p-6 flex gap-5 overflow-x-hidden">
        {[1, 2, 3].map((index) => (
          <div key={index} className="w-72 bg-slate-200/60 rounded-xl p-3 shrink-0 flex flex-col gap-3 h-[calc(100vh-12rem)]">
            {/* Заголовок колонки */}
            <div className="flex justify-between items-center px-1">
              <div className="h-4 w-24 bg-slate-300 rounded-md" />
              <div className="h-6 w-6 bg-slate-300 rounded-full" />
            </div>
            
            {/* Карточки внутри */}
            <div className="space-y-2.5 flex-1">
              <div className="h-16 bg-white rounded-lg border border-slate-200/40 shadow-xs" />
              <div className="h-20 bg-white rounded-lg border border-slate-200/40 shadow-xs" />
              <div className="h-14 bg-white rounded-lg border border-slate-200/40 shadow-xs" />
            </div>

            {/* Кнопка добавления */}
            <div className="h-9 bg-slate-200 rounded-lg w-full" />
          </div>
        ))}
      </div>
    </div>
  );
};