import os

base = os.path.expanduser('~/greenroom-starter')
path = f'{base}/app/shows/[id]/settle/page.tsx'

content = '''import {{ notFound }} from "next/navigation";
import {{ getShowById }} from "@/lib/queries";
import {{ SettleClient }} from "./settle-client";

export default async function SettlePage({{
  params,
}}: {{
  params: Promise<{{ id: string }}>;
}}) {{
  const {{ id }} = await params;
  const data = await getShowById(id);
  if (!data) notFound();

  const {{ show, artist, deal, ticketSales, expenses, settlement, recoups, venue }} = data;

  return (
    <SettleClient
      show={{show}}
      artist={{artist}}
      deal={{deal}}
      ticketSales={{ticketSales}}
      expenses={{expenses}}
      settlement={{settlement}}
      recoups={{recoups}}
      venue={{venue}}
    />
  );
}}
'''

with open(path, 'w') as f:
    f.write(content)
print(f"Written: {path}")