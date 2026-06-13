"""輸出序列化層。

**鐵律 3**：匿名遮蔽只在此層做。所有對外輸出路徑（REST API、WebSocket
payload、匯出產生器）都必須經過 ``mask_identity``，不得在各功能各自實作。
"""
