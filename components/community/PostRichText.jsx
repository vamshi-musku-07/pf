import React from "react";
import { Text } from "react-native";
import { tokenizePostContent } from "@/lib/postTags";

/**
 * Instagram / Threads style caption:
 * mentions & hashtags stay inline in the text (subtle link weight),
 * never rendered as a chip row beside the caption.
 */
export default function PostRichText({
  content = "",
  style,
  mentionStyle,
  hashtagStyle,
  onPressMention,
  onPressHashtag,
  numberOfLines,
}) {
  const segments = tokenizePostContent(content);

  if (!segments.length) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {content}
      </Text>
    );
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((seg, i) => {
        if (seg.type === "mention") {
          return (
            <Text
              key={`m-${i}`}
              style={mentionStyle}
              onPress={() => onPressMention?.(seg.value.replace(/^@/, ""))}
            >
              {seg.value}
            </Text>
          );
        }
        if (seg.type === "hashtag") {
          return (
            <Text
              key={`h-${i}`}
              style={hashtagStyle}
              {...(onPressHashtag
                ? { onPress: () => onPressHashtag(seg.value.replace(/^#/, "")) }
                : {})}
            >
              {seg.value}
            </Text>
          );
        }
        return <Text key={`t-${i}`}>{seg.value}</Text>;
      })}
    </Text>
  );
}
