import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PageHeader } from "@/components/site/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSettings, settingList, settingText } from "@/server/services/settings.service";

export const revalidate = 300;

interface Section {
  heading: string;
  text: string;
}

interface Stat {
  value: string;
  label: string;
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: settingText(settings, "pages.about.title", "About us"),
    description: settingText(settings, "pages.about.lead"),
  };
}

export default async function AboutPage() {
  const settings = await getSettings();

  const image = settingText(settings, "pages.about.image");
  const sections = settingList<Section>(settings, "pages.about.body");
  const stats = settingList<Stat>(settings, "pages.about.stats");

  return (
    <>
      <PageHeader
        eyebrow={settingText(settings, "pages.about.eyebrow")}
        title={settingText(settings, "pages.about.title", "About us")}
        lead={settingText(settings, "pages.about.lead")}
        tint="cream"
      />

      <div className="section-shell py-10 lg:py-14">
        {image && (
          <div className="relative mb-12 aspect-16/7 overflow-hidden rounded-3xl bg-secondary">
            <Image
              src={image}
              alt=""
              fill
              sizes="(min-width: 1024px) 1024px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        )}

        {stats.length > 0 && (
          <div className="mb-12 grid gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <Card key={stat.label} className="p-6 text-center">
                <p className="text-3xl font-bold text-primary tabular-nums">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </Card>
            ))}
          </div>
        )}

        <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-2">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold">{section.heading}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                {section.text}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center gap-3 rounded-3xl bg-secondary/60 p-8 text-center sm:p-10">
          <h2 className="text-xl font-bold">Hungry yet?</h2>
          <p className="max-w-md text-sm text-muted-foreground text-pretty">
            Today&apos;s menu is up. Order online and collect it warm.
          </p>
          <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/menu">See today&apos;s menu</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/contact">Find us</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
