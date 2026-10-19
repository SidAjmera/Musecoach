import { CoachId } from "@/lib/types";
import { coaches } from "@/lib/coaches";
export default function Avatar({
  coach = "Sunny",
  appearance = coaches.find((c) => c.id === coach)?.defaultVersion === "male"
    ? "masculine"
    : "feminine",
  className = "",
  decorated = false,
}: {
  coach?: CoachId;
  appearance?: string;
  className?: string;
  decorated?: boolean;
}) {
  const index = coaches.findIndex((c) => c.id === coach),
    color = coaches[index]?.color || "#f5bd6a",
    long = appearance === "feminine",
    skin = ["#cc8c67", "#b47758", "#d59a77", "#ddb08c", "#c39272"][index % 5],
    hair = ["#283b3d", "#3b3033", "#383044", "#50443c", "#303f3d"][index % 5];
  return (
    <svg
      className={className}
      viewBox="0 0 320 320"
      role="img"
      aria-label={`${coach}, original ${appearance} coach illustration`}
    >
      <defs>
        <pattern
          id={`grain-${coach}-${appearance}`}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="2" r=".5" fill="#fff" opacity=".13" />
        </pattern>
      </defs>
      <circle cx="160" cy="160" r="145" fill={color} opacity=".55" />
      {decorated && (
        <g fill="none" stroke="#628173" strokeWidth="2">
          <path d="M34 220q-18-65 7-116M37 171l-20-23m21 6 20-25M273 221q24-55 5-111m0 48 21-27m-20 42-18-21" />
          <path
            d="m72 52 4-14 4 14 14 4-14 4-4 14-4-14-14-4Z"
            fill="#fff3cb"
            stroke="none"
          />
          <circle cx="257" cy="69" r="7" fill="#f6e3a2" stroke="none" />
        </g>
      )}
      <path
        d="M66 299q4-81 94-82t94 82"
        fill={index % 2 ? "#586d65" : "#53786f"}
      />
      <path d="m127 220 33 46 34-46" fill="#f2d8ae" />
      <path
        d={
          long
            ? "M87 177C53 75 104 42 161 46c75-9 109 74 75 143l-2 51-49-21-62 11-38-4Z"
            : "M91 163C69 81 108 43 161 46c65-6 99 55 67 119l-14-50-105-1Z"
        }
        fill={hair}
      />
      {long && (
        <path
          d="M90 144Q50 204 83 258l44-22-2-83m107-9q42 81 0 111l-41-23 3-83"
          fill={hair}
        />
      )}
      <ellipse cx="103" cy="157" rx="16" ry="21" fill={skin} />
      <ellipse cx="216" cy="157" rx="16" ry="21" fill={skin} />
      <path d="M141 190v37q19 26 38 0v-37" fill={skin} />
      <path d="M110 110q48-52 100 2v59q-3 57-51 57-46-4-49-58Z" fill={skin} />
      <path
        d="M101 129q-8-59 37-65 74-27 88 67-29-12-39-40-29 35-86 38"
        fill={hair}
      />
      <g fill="none" stroke={hair} strokeLinecap="round">
        <path d="M125 148q8-6 16 0m38 0q8-6 16 0" strokeWidth="4" />
        <path d="m158 157-4 15 8 2" strokeWidth="2" />
        <path d="M140 185q20 24 40-1Z" fill="#fff8e9" strokeWidth="2" />
      </g>
      <g fill="#e9957c" opacity=".45">
        <ellipse cx="128" cy="170" rx="12" ry="6" />
        <ellipse cx="192" cy="170" rx="12" ry="6" />
      </g>
      {long && (
        <g fill="#e7be6d">
          <circle cx="104" cy="177" r="5" />
          <circle cx="216" cy="177" r="5" />
        </g>
      )}
      {appearance === "masculine" && (
        <path
          d="M123 194q37 40 75-1-8 37-38 38-30-4-37-37"
          fill={hair}
          opacity=".35"
        />
      )}
      <path
        d="m105 279 18 20m90-20-18 20"
        stroke="#adc2b3"
        opacity=".5"
        strokeWidth="2"
      />
      <circle cx="160" cy="282" r="4" fill="#e5c992" />
      {coach === "Theo" && (
        <g fill="none" stroke="#d9d1ba" strokeWidth="4">
          <circle cx="132" cy="150" r="21" />
          <circle cx="188" cy="150" r="21" />
          <path d="M153 148h14m-56-4-12-5m110 5 12-5" />
        </g>
      )}
      {coach === "Jules" && (
        <g fill="none" stroke="#91a9bc" strokeWidth="10">
          <path d="M94 153V127a66 66 0 0 1 132 0v26" />
          <path d="M93 147v32m135-32v32" strokeWidth="16" />
        </g>
      )}
      {coach === "Nova" && (
        <path
          d="m213 170 4-8 4 8 9 2-7 6 2 9-8-5-8 5 2-9-7-6Z"
          fill="#e7c970"
        />
      )}
      {coach === "Sage" && (
        <g fill="#b1c594">
          <path d="M107 115q-24-27 0-41 22 18 0 41Z" />
          <path d="M108 110q-2-29 24-30 5 24-24 30Z" />
        </g>
      )}
      {coach === "Rex" && (
        <path
          d="m123 135 20-3m35 0 20 3"
          stroke={hair}
          strokeWidth="5"
          strokeLinecap="round"
        />
      )}
      {coach === "Cleo" && (
        <g fill="#e5c3a4">
          <circle cx="107" cy="105" r="11" />
          <circle cx="96" cy="116" r="11" />
          <circle cx="118" cy="116" r="11" />
          <circle cx="108" cy="126" r="11" />
          <circle cx="107" cy="115" r="7" fill="#ba874e" />
        </g>
      )}
      {coach === "Lola" && (
        <path
          d="m127 226 32 16 36-16-5 22-27 4 26 39-19 3-23-41-22-7Z"
          fill="#b26b79"
        />
      )}
      {coach === "Ash" && (
        <>
          <path d="M96 120Q84 51 158 48q74-4 73 72Z" fill="#849880" />
          <path d="M96 109q64-22 135 0v18q-69-18-135 0Z" fill="#adc0a0" />
        </>
      )}
      {coach === "Kai" && (
        <path d="M100 116q60-24 124 0l-3 13q-58-20-120 0Z" fill="#86b9bd" />
      )}
      {decorated && (
        <>
          <path
            d="m264 249 5-16 5 16 16 5-16 5-5 16-5-16-16-5Z"
            fill="#f5d680"
          />
          <path d="m62 94 3-10 3 10 10 3-10 3-3 10-3-10-10-3Z" fill="#faf2ce" />
        </>
      )}
      <circle
        cx="160"
        cy="160"
        r="145"
        fill={`url(#grain-${coach}-${appearance})`}
      />
    </svg>
  );
}
