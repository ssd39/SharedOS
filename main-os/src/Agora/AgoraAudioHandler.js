class AgoraAudioHandler{

    client = null
    agoraToken="YOUR_AGORA_KEY"
    
    constructor(){
        this.client = window.AgoraRTC.createClient({  mode: "rtc", codec: "vp8" });

        this.client.on("user-published", async (user, mediaType) => {

            // Subscribe to a remote user.
            await this.client.subscribe(user, mediaType);

            // If the subscribed track is audio.
            if (mediaType === "audio") {
              const remoteAudioTrack = user.audioTrack;
              remoteAudioTrack.play()
            }
        });

        this.client.on("user-unpublished", user => {
            // Get the dynamically created DIV container.
            const playerContainer = document.getElementById(user.uid);
            // Destroy the container.
            if(playerContainer){
                playerContainer.remove();
            }
        });
    }


    async leaveChannel(){
        await (this.client).leave();
    }

    async createChannel(channel_name){
        await this.client.join(this.agoraToken,channel_name,null,null);
    }

    async joinChannel(channel_name){
        await this.client.join(this.agoraToken,channel_name,null,null);
    }

}

export default AgoraAudioHandler;