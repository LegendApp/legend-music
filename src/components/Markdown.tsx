import { useColorScheme } from "react-native";
import MarkdownDisplay, { MarkdownIt, type RenderRules } from "react-native-markdown-display";

import { VideoPlayer } from "@/components/VideoPlayer";

// import blockEmbedPlugin from 'markdown-it-block-embed';

const markdownItInstance = MarkdownIt({
    typographer: true,
    linkify: true,
    html: true,
});

type MarkdownProps = {
    children: string;
};

// Define a proper type for the markdown styles
type MarkdownStylesType = {
    [key: string]: any;
};

// Layout styles consistent with GitHub's markdown styling
const layoutStyles: MarkdownStylesType = {
    // Base text
    body: {
        lineHeight: 28,
        paddingVertical: 8,
        fontSize: 16,
    },

    // Blockquotes
    blockquote: {
        borderLeftWidth: 4,
        paddingLeft: 12,
        paddingVertical: 8,
        marginVertical: 16,
        marginHorizontal: 0,
    },

    // Code blocks and inline code
    code_inline: {
        padding: 4,
        borderRadius: 4,
        fontFamily: "Menlo",
        fontSize: 14,
    },
    code_block: {
        margin: 16,
        padding: 16,
        borderRadius: 4,
    },
    code_block_text: {
        fontFamily: "Menlo",
        fontSize: 14,
        lineHeight: 21,
    },
    fence: {
        marginVertical: 16,
        padding: 16,
        borderRadius: 4,
    },
    fence_text: {
        fontFamily: "Menlo",
        fontSize: 14,
        lineHeight: 21,
    },

    // Headers
    heading1: {
        fontSize: 32,
        fontWeight: "600",
        marginTop: 24,
        marginBottom: 16,
        lineHeight: 40,
        borderBottomWidth: 1,
        paddingBottom: 8,
    },
    heading2: {
        fontSize: 24,
        fontWeight: "600",
        marginTop: 24,
        marginBottom: 16,
        lineHeight: 30,
        borderBottomWidth: 1,
        paddingBottom: 6,
    },
    heading3: {
        fontSize: 20,
        fontWeight: "600",
        marginTop: 24,
        marginBottom: 16,
        lineHeight: 25,
    },
    heading4: {
        fontSize: 16,
        fontWeight: "600",
        marginTop: 24,
        marginBottom: 16,
        lineHeight: 20,
    },
    heading5: {
        fontSize: 14,
        fontWeight: "600",
        marginTop: 24,
        marginBottom: 16,
        lineHeight: 18,
    },
    heading6: {
        fontSize: 13.5,
        fontWeight: "600",
        marginTop: 24,
        marginBottom: 16,
        lineHeight: 17,
    },

    // Horizontal rule
    hr: {
        height: 1,
        marginVertical: 24,
        width: "100%",
    },

    // Lists
    bullet_list: {
        // marginTop: 16,
        marginBottom: 16,
        paddingLeft: 0,
    },
    ordered_list: {
        marginTop: 16,
        marginBottom: 16,
        paddingLeft: 0,
    },
    list_item: {
        marginTop: 4,
        marginBottom: 4,
    },

    // Paragraphs
    paragraph: {
        marginTop: 0,
        marginBottom: 16,
        lineHeight: 24,
    },

    // Images
    image: {
        maxWidth: "100%",
        marginTop: 8,
        marginBottom: 16,
    },

    // Tables
    table: {
        marginTop: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderRadius: 3,
        overflow: "hidden",
    },
    thead: {
        borderBottomWidth: 1,
    },
    tr: {
        borderBottomWidth: 1,
    },
    th: {
        padding: 8,
        fontWeight: "600",
    },
    td: {
        padding: 8,
    },
};

// Create separate stylesheets for light and dark themes
const lightMarkdownStyles: MarkdownStylesType = {
    body: {
        color: "#24292e",
        backgroundColor: "transparent",
    },
    blockquote: {
        borderLeftColor: "#dfe2e5",
        backgroundColor: "transparent",
        color: "#6a737d",
    },
    code_inline: {
        backgroundColor: "#f6f8fa",
        color: "#24292e",
        borderWidth: 1,
        borderColor: "#eaecef",
    },
    code_block: {
        backgroundColor: "#f6f8fa",
        borderWidth: 1,
        borderColor: "#eaecef",
    },
    code_block_text: {
        color: "#24292e",
    },
    fence: {
        backgroundColor: "#f6f8fa",
        borderWidth: 1,
        borderColor: "#eaecef",
    },
    fence_text: {
        color: "#24292e",
    },
    heading1: {
        color: "#24292e",
        borderBottomColor: "#eaecef",
    },
    heading2: {
        color: "#24292e",
        borderBottomColor: "#eaecef",
    },
    heading3: {
        color: "#24292e",
    },
    heading4: {
        color: "#24292e",
    },
    heading5: {
        color: "#24292e",
    },
    heading6: {
        color: "#6a737d",
    },
    hr: {
        backgroundColor: "#e1e4e8",
    },
    list_item: {
        color: "#24292e",
    },
    link: {
        color: "#0366d6",
    },
    table: {
        borderColor: "#dfe2e5",
    },
    thead: {
        backgroundColor: "#f6f8fa",
        borderBottomColor: "#dfe2e5",
    },
    tr: {
        borderBottomColor: "#dfe2e5",
    },
    th: {
        color: "#24292e",
    },
    td: {
        color: "#24292e",
    },
    fence_code_comment: {
        color: "#6a737d",
    },
    fence_code_keyword: {
        color: "#d73a49",
    },
    fence_code_string: {
        color: "#032f62",
    },
    fence_code_number: {
        color: "#005cc5",
    },
    fence_code_function: {
        color: "#6f42c1",
    },
};

const darkMarkdownStyles: MarkdownStylesType = {
    body: {
        color: "#c9d1d9",
        backgroundColor: "transparent",
    },
    blockquote: {
        borderLeftColor: "#30363d",
        backgroundColor: "transparent",
        color: "#8b9499",
    },
    code_inline: {
        backgroundColor: "#161b22",
        color: "#c9d1d9",
        borderWidth: 1,
        borderColor: "#30363d",
    },
    code_block: {
        backgroundColor: "#161b22",
        borderWidth: 1,
        borderColor: "#30363d",
    },
    code_block_text: {
        color: "#c9d1d9",
    },
    fence: {
        backgroundColor: "#161b22",
        borderWidth: 1,
        borderColor: "#30363d",
    },
    fence_text: {
        color: "#c9d1d9",
    },
    heading1: {
        color: "#c9d1d9",
        borderBottomColor: "#30363d",
    },
    heading2: {
        color: "#c9d1d9",
        borderBottomColor: "#30363d",
    },
    heading3: {
        color: "#c9d1d9",
    },
    heading4: {
        color: "#c9d1d9",
    },
    heading5: {
        color: "#c9d1d9",
    },
    heading6: {
        color: "#8b949e",
    },
    hr: {
        backgroundColor: "#30363d",
    },
    list_item: {
        color: "#c9d1d9",
    },
    link: {
        color: "#58a6ff",
    },
    table: {
        borderColor: "#30363d",
    },
    thead: {
        backgroundColor: "#161b22",
        borderBottomColor: "#30363d",
    },
    tr: {
        borderBottomColor: "#30363d",
    },
    th: {
        color: "#c9d1d9",
    },
    td: {
        color: "#c9d1d9",
    },
    fence_code_comment: {
        color: "#8b949e",
    },
    fence_code_keyword: {
        color: "#ff7b72",
    },
    fence_code_string: {
        color: "#a5d6ff",
    },
    fence_code_number: {
        color: "#79c0ff",
    },
    fence_code_function: {
        color: "#d2a8ff",
    },
};

export const Markdown = ({ children }: MarkdownProps) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    // Get theme styles based on color scheme
    const themeStyles = isDark ? darkMarkdownStyles : lightMarkdownStyles;

    // Merge layout styles with theme styles
    const markdownStyles = Object.keys({ ...layoutStyles, ...themeStyles }).reduce((styles, key) => {
        styles[key] = {
            ...(layoutStyles[key] || {}),
            ...(themeStyles[key] || {}),
        };
        return styles;
    }, {} as MarkdownStylesType);

    return (
        <MarkdownDisplay style={markdownStyles} markdownit={markdownItInstance} rules={MarkdownRules}>
            {children}
        </MarkdownDisplay>
    );
};

const MarkdownRules: RenderRules = {
    html_inline: (node) => {
        const content = node.content;

        if (content.startsWith("<video")) {
            const src = content.match(/src="([^"]+)"/)?.[1];
            return <VideoPlayer key={src} src={src!} width={300} height={400} />;
        }
        return null;
    },
};
