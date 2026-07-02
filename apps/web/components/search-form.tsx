"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { SearchSuggestions } from "./search-suggestions";

/**
 * The search box with debounced suggestions dropdown.
 */
export function SearchForm({
  basePath = "/",
  defaultQuery = "",
}: {
  basePath?: string;
  defaultQuery?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSuggestionsVisible(false);
      const value =
        inputValue ||
        String(new FormData(event.currentTarget).get("q") ?? "");
      router.push(`${basePath}?tab=search&q=${encodeURIComponent(value)}`);
    },
    [basePath, inputValue, router],
  );

  return (
    <form
      className="search-form"
      role="search"
      action={basePath}
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="tab" value="search" />
      <div className="search-box-wrapper">
        <label className="search-box search-box-large">
          <Search size={18} aria-hidden />
          <input
            ref={inputRef}
            key={defaultQuery}
            name="q"
            aria-label="搜索媒体"
            placeholder="片名 / 剧名"
            defaultValue={defaultQuery}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (e.target.value.length >= 2) {
                setSuggestionsVisible(true);
              } else {
                setSuggestionsVisible(false);
              }
            }}
            onFocus={() => {
              if (inputValue.length >= 2) {
                setSuggestionsVisible(true);
              }
            }}
            autoComplete="off"
          />
        </label>
        <SearchSuggestions
          query={inputValue}
          basePath={basePath}
          visible={suggestionsVisible}
          onClose={() => setSuggestionsVisible(false)}
        />
      </div>
      <button className="primary-button" type="submit">
        <Search size={16} aria-hidden />
        搜索
      </button>
    </form>
  );
}
