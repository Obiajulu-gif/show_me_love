"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { TreatPicker, type TreatChoice } from "./TreatPicker";
import { UsernameField } from "./UsernameField";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

export function ClaimCard() {
  const router = useRouter();
  const [treat, setTreat] = useState<TreatChoice>({ treatId: "zobo" });
  const [username, setUsername] = useState("");
  const [ok, setOk] = useState(false);
  return (
    <Card className="w-full max-w-md">
      <h2 className="font-semibold"><span className="mr-2 text-cocoa-2">01</span>What should people buy you?</h2>
      <div className="mt-3"><TreatPicker value={treat} onChange={setTreat} /></div>
      <h2 className="mt-6 font-semibold"><span className="mr-2 text-cocoa-2">02</span>Claim your username</h2>
      <div className="mt-3"><UsernameField value={username} onChange={setUsername} onStatus={setOk} /></div>
      <Button disabled={!ok} onClick={() => router.push(`/signup?treat=${encodeURIComponent(treat.treatId)}&username=${encodeURIComponent(username)}`)} className="mt-3 w-full">
        Claim my page
      </Button>
    </Card>
  );
}
