import type { Option } from "@alien-worlds/uikit";
import Select, { components } from "react-select";
import {
  DAO_OPTIONS,
  DROPDOWN_STYLES,
  PLANET_OPTIONS,
} from "./createProposalConstants";

export interface CreateProposalStep1Props {
  slot: "form" | "preview";
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  memo: string;
  setMemo: (v: string) => void;
  selectedPlanet: Option | null;
  setSelectedPlanet: (v: Option | null) => void;
  selectedDao: Option | null;
  setSelectedDao: (v: Option | null) => void;
  planetIcons: Record<string, string>;
  previousPlanet: string;
  planetImages: Record<string, string>;
}

function formatPlanetOption(
  option: Option,
  planetIcons: Record<string, string>,
) {
  return (
    <div className="flex items-center gap-2">
      {planetIcons[option.value] ? (
        <img
          src={planetIcons[option.value]}
          alt=""
          className="w-5 h-5 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <span className="w-5 h-5 rounded-full bg-amber-400/80 flex-shrink-0 block" />
      )}
      <span>{option.label}</span>
    </div>
  );
}

export function CreateProposalStep1({
  slot,
  title,
  setTitle,
  description,
  setDescription,
  memo,
  setMemo,
  selectedPlanet,
  setSelectedPlanet,
  selectedDao,
  setSelectedDao,
  planetIcons,
  previousPlanet,
  planetImages,
}: CreateProposalStep1Props) {
  if (slot === "form") {
    return (
      <div className="space-y-5">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title..."
          className="create-proposal-field"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description..."
          rows={4}
          className="create-proposal-description"
        />
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Memo..."
          className="create-proposal-field"
        />
        <div className="grid grid-cols-1 gap-5">
          <div className="w-full">
            <Select
              options={PLANET_OPTIONS}
              value={selectedPlanet}
              onChange={(opt) => setSelectedPlanet(opt as Option | null)}
              formatOptionLabel={(opt) => formatPlanetOption(opt, planetIcons)}
              components={{
                SingleValue: ({ data, ...props }) => (
                  <components.SingleValue {...props} data={data}>
                    {data ? formatPlanetOption(data, planetIcons) : null}
                  </components.SingleValue>
                ),
              }}
              placeholder="Select Planet"
              classNamePrefix="create-proposal-planet-select"
              styles={{
                ...DROPDOWN_STYLES,
                control: (base: Record<string, unknown>) => ({
                  ...DROPDOWN_STYLES.control(base),
                  height: 40,
                  minHeight: 40,
                }),
              }}
              menuPortalTarget={document.body}
              menuPosition="fixed"
            />
          </div>
          <div className="w-full">
            <Select
              options={DAO_OPTIONS}
              value={selectedDao}
              onChange={(opt) => setSelectedDao(opt as Option | null)}
              placeholder="Select DAO"
              classNamePrefix="create-proposal-dao-select"
              styles={{
                ...DROPDOWN_STYLES,
                control: (base: Record<string, unknown>) => ({
                  ...DROPDOWN_STYLES.control(base),
                  height: 40,
                  minHeight: 40,
                }),
              }}
              menuPortalTarget={document.body}
              menuPosition="fixed"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 rounded-[8px] overflow-hidden p-2 bg-black">
      <div className="relative w-full h-full min-h-0 rounded-[8px] overflow-hidden">
        {previousPlanet !== (selectedPlanet?.value ?? "eyeke") && (
          <img
            src={planetImages[previousPlanet] ?? ""}
            alt=""
            aria-hidden
            className="create-proposal-planet-image-out absolute inset-0 w-full h-full object-cover rounded-[8px]"
          />
        )}
        <img
          key={selectedPlanet?.value ?? "eyeke"}
          src={planetImages[selectedPlanet?.value || "eyeke"] ?? ""}
          alt={selectedPlanet?.label ?? "Planet"}
          className="create-proposal-planet-image-in absolute inset-0 w-full h-full min-h-0 object-cover rounded-[8px]"
        />
      </div>
    </div>
  );
}
