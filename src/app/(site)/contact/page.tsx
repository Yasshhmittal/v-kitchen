import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { PageHeader } from "@/components/site/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatTime24to12 } from "@/lib/format";
import { getSettings, settingList, settingText } from "@/server/services/settings.service";

export const revalidate = 300;

interface OpeningHour {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: settingText(settings, "pages.contact.title", "Contact"),
    description: settingText(settings, "pages.contact.lead"),
  };
}

export default async function ContactPage() {
  const settings = await getSettings();

  const phone = settingText(settings, "contact.phone");
  const whatsapp = settingText(settings, "contact.whatsapp");
  const email = settingText(settings, "contact.email");
  const address = settingText(settings, "contact.address");
  const mapsEmbed = settingText(settings, "contact.mapsEmbedUrl");
  const mapsLink = settingText(settings, "contact.mapsLink");
  const hoursNote = settingText(settings, "hours.note");
  const hours = settingList<OpeningHour>(settings, "hours.weekly");
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <>
      <PageHeader
        eyebrow={settingText(settings, "pages.contact.eyebrow")}
        title={settingText(settings, "pages.contact.title", "Come and find us")}
        lead={settingText(settings, "pages.contact.lead")}
        tint="sage"
      />

      <div className="section-shell py-10 lg:py-14">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="font-semibold">Get in touch</h2>

              <ul className="mt-5 space-y-4 text-sm">
                {phone && (
                  <ContactRow icon={Phone} label="Phone">
                    <a
                      href={`tel:${phone.replace(/\s+/g, "")}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {phone}
                    </a>
                  </ContactRow>
                )}

                {whatsapp && (
                  <ContactRow icon={MessageCircle} label="WhatsApp">
                    <a
                      href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {whatsapp}
                    </a>
                  </ContactRow>
                )}

                {email && (
                  <ContactRow icon={Mail} label="Email">
                    <a
                      href={`mailto:${email}`}
                      className="font-medium break-all underline-offset-2 hover:underline"
                    >
                      {email}
                    </a>
                  </ContactRow>
                )}

                {address && (
                  <ContactRow icon={MapPin} label="Address">
                    <span className="font-medium whitespace-pre-line">{address}</span>
                    {mapsLink && (
                      <a
                        href={mapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-xs font-semibold text-primary underline underline-offset-2"
                      >
                        Open in Maps
                      </a>
                    )}
                  </ContactRow>
                )}
              </ul>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <Button asChild className="flex-1">
                  <Link href="/menu">Order for pickup</Link>
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/bulk-order">Bulk enquiry</Link>
                </Button>
              </div>
            </Card>

            {hours.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-primary" aria-hidden />
                  <h2 className="font-semibold">Opening hours</h2>
                </div>

                <dl className="mt-4 space-y-1.5 text-sm">
                  {hours.map((hour) => {
                    const isToday = hour.day === today;
                    return (
                      <div
                        key={hour.day}
                        className={
                          isToday
                            ? "flex justify-between rounded-lg bg-primary/8 px-2.5 py-1.5 font-semibold text-primary"
                            : "flex justify-between px-2.5 py-1.5"
                        }
                      >
                        <dt>
                          {hour.day}
                          {isToday && <span className="ml-1.5 text-xs font-medium">Today</span>}
                        </dt>
                        <dd className={hour.closed ? "text-muted-foreground" : "tabular-nums"}>
                          {hour.closed
                            ? "Closed"
                            : `${formatTime24to12(hour.open)} – ${formatTime24to12(hour.close)}`}
                        </dd>
                      </div>
                    );
                  })}
                </dl>

                {hoursNote && (
                  <p className="mt-4 text-xs text-muted-foreground">{hoursNote}</p>
                )}
              </Card>
            )}
          </div>

          {mapsEmbed ? (
            <Card className="overflow-hidden lg:sticky lg:top-24">
              <iframe
                src={mapsEmbed}
                title="Our location on a map"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="aspect-4/3 w-full border-0 lg:aspect-auto lg:h-[34rem]"
                allowFullScreen
              />
            </Card>
          ) : (
            <Card className="grid place-items-center p-10 text-center lg:sticky lg:top-24">
              <div>
                <MapPin className="mx-auto size-8 text-muted-foreground" aria-hidden />
                <p className="mt-3 text-sm text-muted-foreground">
                  {address || "Our address will appear here shortly."}
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function ContactRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Phone;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-secondary">
        <Icon className="size-4 text-primary" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        {children}
      </span>
    </li>
  );
}
