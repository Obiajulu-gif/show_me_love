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
      <h3 className="font-semibold">What should people send you?</h3>
      <div className="mt-3"><TreatPicker value={treat} onChange={setTreat} /></div>
      <h3 className="mt-6 font-semibold">Claim your link</h3>
      <div className="mt-3"><UsernameField value={username} onChange={setUsername} onStatus={setOk} /></div>
      <Button disabled={!ok} onClick={() => router.push(`/signup?treat=${encodeURIComponent(treat.treatId)}&username=${encodeURIComponent(username)}`)} className="mt-3 w-full">
        Claim my page
      </Button>
    </Card>
  );
}
