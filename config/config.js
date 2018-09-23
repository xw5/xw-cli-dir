module.exports={
    css:'less',//css模块化方式
    js:'requirejs',//js模块化开发方式
    version:'vmd5',//文件版本管理方式
    rem:false,//是否是rem布局项目
    remConfig:{//rem相关配置
        'width_design':1080,//设计稿尺寸
        'valid_num':6,//保留小数位
        'pieces':10//屏幕宽分成多少份
    },
    sprite:true,//是否需要精灵图
    template:false,//是否开启html模板支持
    cdnUrl:'http://www.test.com/',//资源要走的cdn路径
    devUrl:'./dist/',//开发构建到的目录
    publishUrl:'./publish/',//上线构建到目录
    revUrl:'./temp/rev/'//用于存储版本管理信息的目录
}