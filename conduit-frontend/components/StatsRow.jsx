export default function StatsRow({ stats }) {
  return (
    <section className="border-y border-hairline">
      <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-hairline px-5 lg:grid-cols-3 lg:divide-x lg:divide-y-0 lg:px-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center justify-center py-10 text-center first:pt-0 last:pb-0 lg:px-8 lg:py-14 lg:first:pl-0 lg:last:pr-0"
          >
            <div className="font-mono text-4xl font-medium tracking-tight text-paper lg:text-5xl">
              {stat.prefix}
              {stat.value}
            </div>
            <div className="mt-3 min-h-[42px] text-[14px] text-paper-faint">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
