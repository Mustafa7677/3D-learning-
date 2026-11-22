import type { Metadata } from "next";
import { Problems } from "@/components/problems/Problems";

export const metadata: Metadata = {
  title: "Есептер залы | INSIDE TECH",
  description: "Қиын есептер: маманның шешімін фильм сияқты талда, жолды таңда, ұқсас есепті өзің шығар. Күн сайын бір есеп және серия.",
};

export default function Page() {
  return <Problems />;
}
